UUID = pwa-shelf@mcda.local

.PHONY: pack test install
pack:
	mkdir -p dist
	gnome-extensions pack --force --out-dir=dist --extra-source=apps.js .

test:
	glib-compile-schemas --strict --dry-run schemas
	gjs -m tests/apps.test.js

install: pack
	gnome-extensions install --force dist/$(UUID).shell-extension.zip
