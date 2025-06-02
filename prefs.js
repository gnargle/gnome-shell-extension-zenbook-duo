'use strict';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {SetupUtils} from './setup-utils.js';
import {ReturnCodes as InstallerCodes} from './setup-utils.js';

export default class ZenbookDuoExtPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
		window.set_default_size(1000, 400);
        window._settings = this.getSettings('org.gnome.shell.extensions.zenbook-duo');
        window.add(this.getPrefsWidget());
    }

    getPrefsWidget() {
        let buildable = new Gtk.Builder();
        buildable.add_from_file(this.dir.get_path() + '/prefs.ui');
        let box = buildable.get_object('prefs_widget');

        let version_label = buildable.get_object('version_label');
        version_label.set_text(`Version ${this.metadata.version.toString()}`);

		new ExtStatusBox(buildable, new SetupUtils(this)).update();

        let settings = this.getSettings('org.gnome.shell.extensions.zenbook-duo');

        settings.bind('myasus-cmd', buildable.get_object('entry_myasus_cmd'), 'text', Gio.SettingsBindFlags.DEFAULT);

        settings.connect('changed::screenshot-type', () => this.update_screenshot_type_buttons(buildable));
        this.update_screenshot_type_buttons(buildable, settings);

        const screenshot_screen = buildable.get_object('screenshot_screen');
        screenshot_screen.connect('toggled', (x) => {
            if (screenshot_screen.get_active()) settings.set_string('screenshot-type', 'Screen');
        });
        const screenshot_window = buildable.get_object('screenshot_window');
        screenshot_window.connect('toggled', (x) => {
            if (screenshot_window.get_active()) settings.set_string('screenshot-type', 'Window');
        });
        const screenshot_selection = buildable.get_object('screenshot_selection');
        screenshot_selection.connect('toggled', (x) => {
            if (screenshot_selection.get_active()) settings.set_string('screenshot-type', 'Selection');
        });
        const screenshot_interactive = buildable.get_object('screenshot_interactive');
        screenshot_interactive.connect('toggled', (x) => {
            if (screenshot_interactive.get_active()) settings.set_string('screenshot-type', 'Interactive');
        });

        settings.bind(
            'screenshot-include-cursor',
            buildable.get_object('switch_screenshot_cursor'),
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        settings.set_boolean('uninstall', false); // clear dangling flags if a previous request failed
        const button_uninstall = buildable.get_object('button_uninstall');
        button_uninstall.connect('clicked', () => {
            settings.set_boolean('uninstall', true);
        });

        return box;
    }

    update_screenshot_type_buttons(buildable, settings) {
        switch (settings.get_string('screenshot-type')) {
            case 'Screen':
                buildable.get_object('screenshot_screen').set_active(true);
                break;
            case 'Window':
                buildable.get_object('screenshot_window').set_active(true);
                break;
            case 'Selection':
                buildable.get_object('screenshot_selection').set_active(true);
                break;
            case 'Interactive':
                buildable.get_object('screenshot_interactive').set_active(true);
                break;
        }
    }
}

class ExtStatusBox {
	/**
	 * @param {SetupUtils} setup_utils 
	 */
	constructor(buildable, setup_utils) {
		this.status_label = buildable.get_object('status_label');
		this.status_description = buildable.get_object('status_description');
		this.action_btn = buildable.get_object('status_action_btn');
		this.result_label = buildable.get_object('status_last_result');
		this.setup_utils = setup_utils;
		
		this.action_btn.set_visible(false);
		this.status_description.set_text("unknown");
		this.result_label.set_text("");
		this.result_label.set_visible(false);
	}

	update() {
		log('Checking if additional screenpad files are installed');
        this.setup_utils.checkInstalled().then((result) => {
            switch (result) {
                case InstallerCodes.EXIT_SUCCESS:
                    // Only check for the udev rule if the additional files are installed
					if (this._isOldUdevRulePresent()) {
                        this.status_label.set_text(
                            'You still have the old udev rule on your system');
						this.status_description.set_text(
                            "This rule was previously used to get write access on the brightness file, but it isn't needed anymore.");
                        this._set_action('Click here to see how to remove it', () => this._showUdevRuleRemoveInstruction());
                    } else {
						this.status_label.set_text('Setup complete');
						this.status_description.set_text('Extension ready to use');
					}
                    break;
                case InstallerCodes.EXIT_NOT_INSTALLED:
                    this.status_label.set_text(
                        'This extension requires additional configuration');
					this.status_description.set_text(
                        "In order for this extension to work, it needs to install some files. "+
						"You can undo this in the extension's settings.");
					this._set_action('Click here to do this automatically', () => this._runToolsInstall());
                    break;
                case InstallerCodes.EXIT_NEEDS_UPDATE:
                    this.status_label.set_text(
                        'The additional files for the Screenpad+ extension requires an update');
					this.status_description.set_text(
                        'The extension has been updated, but the additional files need to be updated separately.');
                    this._set_action('Click here to do this automatically', () => this._runToolsInstall());
                    break;
				case InstallerCodes.EXIT_SCREENPAP_CTRL_FILE_MISSING:
					this.status_label.set_text('The Screenpad brightness file does not exist');
		            this.status_description.set_text(
						'Ensure the asus-wmi-screenpad module is installed and loaded '+
						'and that your device is compatible with this module.');
		            this._set_action('Click here to see how to do this', () => this._showScreenpadModuleInstruction());
					break;
				default:
					this.status_label.set_text('Screenpad setup status');
					this.status_description.set_text('Unknown status');
            }
        }).catch((err) => console.error(err));
	}
	
	_set_action(label, runable) {
		this.action_btn.set_label(label);
		this.action_btn.set_visible(true);
		this.action_btn.connect('clicked', () => runable());
	}
	
	_set_result_msg(msg) {
		this.result_label.set_text(msg);
		this.result_label.set_visible(true);
	}
	
	async _runToolsInstall() {
		this.action_btn.set_visible(false);
		switch (await this.setup_utils.install()) {
            case InstallerCodes.EXIT_SUCCESS:
                this._set_result_msg('The files have been installed successfully.');
                break;
            case InstallerCodes.EXIT_FAILURE:
				this._set_result_msg('Failed. The files could not be installed.');
                break;
			case InstallerCodes.EXIT_PERMISSION_DENIED:
				this._set_result_msg('Failed. No permission.');
				break;
			default:
				this._set_result_msg('Unknown error'); 
        }
		this.update();
	}
	
	async _showScreenpadModuleInstruction() {
		Gio.AppInfo.launch_default_for_uri_async(
            'https://github.com/Plippo/asus-wmi-screenpad#readme',
            null,
            null,
            null
        );
	}
	
	async _showUdevRuleRemoveInstruction() {
		Gio.AppInfo.launch_default_for_uri_async(
	        'https://github.com/laurinneff/gnome-shell-extension-zenbook-duo/blob/master/docs/permissions.md#removing-the-old-udev-rule',
	        null,
	        null,
	        null
	    );
	}
	
	_isOldUdevRulePresent() {
		const udevRuleFile = Gio.File.new_for_path('/etc/udev/rules.d/99-screenpad.rules');
		return udevRuleFile.query_exists(null);
	}
}
