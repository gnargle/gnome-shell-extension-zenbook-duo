import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export class SetupUtils {

    /**
     * 
     * @param {Extension} extension 
     */
    constructor(extension) {
        this.EXTENSIONDIR = extension.dir.get_path();
		this.SCREENPAD_SYS_FS_PATH = '/sys/class/leds/asus::screenpad';
        this.INSTALLER = `${this.EXTENSIONDIR}/scripts/installer.sh`;
        this.TOOL_SUFFIX = GLib.get_user_name();
        this.PKEXEC = GLib.find_program_in_path('pkexec');
        this.SH = GLib.find_program_in_path('sh');
    }

    checkInstalled() {
		return new Promise((resolve, reject) => {
			this._screenpadBrightnessFile = Gio.File.new_for_path(`${this.SCREENPAD_SYS_FS_PATH}/brightness`);
		    if (!this._screenpadBrightnessFile.query_exists(null)) {
				log('Screenpad file missing');
				resolve(ReturnCodes.EXIT_SCREENPAP_CTRL_FILE_MISSING);
			} else {
	 			return this._spawnProcessCheckExitCode(
		            this.SH,
		            this.INSTALLER,
		            '--prefix',
		            '/usr',
		            '--suffix',
		            this.TOOL_SUFFIX,
		            '--extension-path',
		            this.EXTENSIONDIR,
		            'check'
	    		).then(value => { resolve(value); });
			}
		});
		
    }

    install() {
        return this._spawnProcessCheckExitCode(
            this.PKEXEC,
            this.SH,
            this.INSTALLER,
            '--prefix',
            '/usr',
            '--suffix',
            this.TOOL_SUFFIX,
            '--extension-path',
            this.EXTENSIONDIR,
            'install'
        );
    }

    uninstall() {
        return this._spawnProcessCheckExitCode(
            this.PKEXEC,
            this.SH,
            this.INSTALLER,
            '--prefix',
            '/usr',
            '--suffix',
            this.TOOL_SUFFIX,
            '--extension-path',
            this.EXTENSIONDIR,
            'uninstall'
        );
    }

    _spawnProcessCheckExitCode(...argv) {
        return new Promise((resolve, reject) => {
            let [ok, pid, stdin, stdout, stderr] = GLib.spawn_async(
                this.EXTENSIONDIR,
                argv,
                null,
                GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            if (!ok) {
                reject();
                return;
            }
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, (process, exitStatus) => {
                GLib.spawn_close_pid(process);
                let exitCode = 0;
                try {
                    GLib.spawn_check_exit_status(exitStatus);
                } catch (e) {
                    exitCode = e.code;
                }
                resolve(exitCode);
            });
        });
    }
}

export const ReturnCodes = Object.freeze({
    EXIT_SUCCESS : 0,
    EXIT_INVALID_ARGUMENT : 1,
    EXIT_FAILURE : 2,
    EXIT_NEEDS_UPDATE : 3,
    EXIT_NOT_INSTALLED : 4,
    EXIT_NEEDS_ROOT : 5,
	EXIT_PERMISSION_DENIED : 126,
	EXIT_SCREENPAP_CTRL_FILE_MISSING : 900,
});