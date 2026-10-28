import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';
import {describeApp, discoverApps, matchApp} from '../apps.js';

let passed = 0;
function check(condition, message) {
    if (!condition)
        throw new Error(message);
    passed++;
}

const appId = 'a'.repeat(32);
function fixture(exec, extra = '') {
    const key = new GLib.KeyFile();
    const data = `[Desktop Entry]\nType=Application\nName=Test PWA\nExec=${exec}\nStartupWMClass=crx_${appId}\n${extra}`;
    key.load_from_data(data, new TextEncoder().encode(data).length, GLib.KeyFileFlags.NONE);
    const info = GioUnix.DesktopAppInfo.new_from_keyfile(key);
    // In-memory entries have no desktop filename. Real metadata still comes
    // from GIO; supply only the ID that a file-backed entry would provide.
    return {
        get_id: () => `chrome-${appId}-Default.desktop`,
        should_show: () => info.should_show(),
        get_commandline: () => info.get_commandline(),
        get_display_name: () => info.get_display_name(),
        get_startup_wm_class: () => info.get_startup_wm_class(),
    };
}
// env is a real executable so GIO accepts these synthetic desktop entries.
const one = describeApp(fixture(`/usr/bin/env google-chrome "--profile-directory=Profile 4" --app-id=${appId}`));
check(one?.appId === appId, 'Quoted profile arguments must survive parsing');
check(describeApp(fixture(`/usr/bin/env chromium-browser.sh --app-id=${appId}`)) !== null, 'Chromium launcher script');
check(describeApp(fixture(`/usr/bin/env org.chromium.Chromium --app-id=${appId}`)) !== null, 'Flatpak app identity');
check(describeApp(fixture(`/usr/bin/env firefox --app-id=${appId}`)) === null, 'Reject other browsers');
check(describeApp(fixture('/usr/bin/env google-chrome --app=https://example.org')) === null, 'Reject URL shortcuts');
check(describeApp(fixture('/usr/bin/env google-chrome --app-id=invalid')) === null, 'Reject invalid app IDs');
check(describeApp(fixture(`/usr/bin/env google-chrome --app-id=${appId}`, 'NoDisplay=true\n')) === null, 'Respect hidden entries');
check(matchApp([one], null, [`crx_${appId}`]) === one, 'Match Chromium WM_CLASS');
check(matchApp([one], null, ['chromium']) === null, 'Do not match ordinary browser windows');
const two = {...one, id: `chrome-${appId}-Profile_4.desktop`};
check(matchApp([one, two], null, [`crx_${appId}`]) === null, 'Ambiguous profiles must not match');
check(matchApp([one, two], two.id, [`crx_${appId}`]) === two, 'Exact desktop ID resolves ambiguity');
check(matchApp([one], null, [one.id.slice(0, -8)]) === one, 'Match Wayland desktop app ID');
const installed = discoverApps();
check(installed.every(app => app.info instanceof Gio.AppInfo), 'Discovery preserves launchable GIO entries');
print(`${passed} checks passed. Installed PWAs: ${installed.map(app => app.name).join(', ') || '(none)'}`);
