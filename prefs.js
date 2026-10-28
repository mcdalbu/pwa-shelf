import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {discoverApps} from './apps.js';

export default class PwaShelfPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'PWA Shelf', icon_name: 'web-browser-symbolic'});
        const group = new Adw.PreferencesGroup({
            title: 'PWAs no painel',
            description: 'Clique no ícone para abrir ou recolher. Botão direito abre o menu. Recolher mantém a janela minimizada; fechar com X encerra a janela.',
        });
        page.add(group);
        const apps = discoverApps();
        for (const app of apps) {
            const row = new Adw.SwitchRow({
                title: app.name,
                subtitle: app.id,
                use_markup: false,
                active: !settings.get_strv('excluded-apps').includes(app.id),
            });
            const icon = app.info.get_icon();
            if (icon)
                row.add_prefix(Gtk.Image.new_from_gicon(icon));
            row.connect('notify::active', () => {
                const excluded = new Set(settings.get_strv('excluded-apps'));
                if (row.active)
                    excluded.delete(app.id);
                else
                    excluded.add(app.id);
                settings.set_strv('excluded-apps', [...excluded]);
            });
            group.add(row);
        }
        if (!apps.length) {
            group.add(new Adw.ActionRow({
                title: 'Nenhuma PWA encontrada',
                subtitle: 'Instale um aplicativo pelo Chrome ou Chromium e abra as preferências novamente.',
            }));
        }
        window.add(page);
    }
}
