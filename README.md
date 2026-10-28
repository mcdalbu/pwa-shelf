# PWA Shelf

Extensão para GNOME Shell 50 que coloca PWAs instaladas pelo Chrome e Chromium no lado direito do painel, com o ícone de cada aplicativo. Não precisa de AppIndicator.

## Instalar

Baixe o ZIP na [página de versões](https://github.com/mcdalbu/pwa-shelf/releases/latest) e instale com:

```sh
gnome-extensions install --force pwa-shelf@mcda.local.shell-extension.zip
```

Para instalar a partir do código-fonte:

```sh
make test
make install
```

Depois da primeira instalação, encerre e entre novamente na sessão do GNOME. Ative a extensão pelo aplicativo **Extensões** ou com:

```sh
gnome-extensions enable pwa-shelf@mcda.local
```

O pacote distribuível fica em `dist/pwa-shelf@mcda.local.shell-extension.zip`. Requer `gjs`, `glib-compile-schemas`, `gnome-extensions` e `make`.

## Usar

- Clique esquerdo: abre a PWA fechada, minimiza suas janelas abertas ou restaura suas janelas minimizadas.
- Clique direito: menu com abrir, recolher, abrir nova janela, fechar as janelas da PWA e preferências. O menu também é acessível pelo teclado na navegação do painel.
- Ícone mais apagado: nenhuma janela identificada como aberta. Ícone normal: há uma janela da PWA. Realce amarelo: a janela pede atenção.
- Nas preferências, escolha quais PWAs aparecem. Novas instalações são detectadas automaticamente.

**Recolher mantém a janela aberta e minimizada.** Ela continua acessível no alternador de janelas e na visão geral. A extensão não intercepta o X, não inicia PWAs no login e não altera configurações do navegador. Desativar a extensão deixa as janelas no estado atual, recuperáveis pela visão geral.

A extensão não garante execução contínua de JavaScript, notificações ou rede: isso depende das permissões do site, do navegador e de suas políticas de suspensão. Uma janela recolhida não equivale a um serviço em segundo plano.

Em `chrome://settings/system`, confira a opção **Continuar executando aplicativos em segundo plano quando o Google Chrome for fechado**, caso esteja disponível na sua versão. Ela controla o modo de segundo plano do navegador; não transforma qualquer PWA fechada em uma página permanentemente ativa. Referência: [BackgroundModeEnabled, documentação do Chrome](https://chromeenterprise.google/intl/en_uk/policies/background-mode-enabled/).

## Detecção e perfis

Usa os lançadores `.desktop` registrados no sistema com `--app-id` do Chrome/Chromium, preservando navegador, perfil, argumentos e ícone ao abrir. Não acessa os dados internos dos perfis. Aplicativos criados apenas com `--app=URL` não são incluídos.

As janelas são associadas primeiro pelo ID do aplicativo identificado pelo GNOME, depois por WM_CLASS/app_id. Quando duas instalações em perfis diferentes têm a mesma identidade e o GNOME não consegue distingui-las, a extensão não escolhe um perfil arbitrariamente; o clique pode abrir outra janela. Isso evita minimizar ou fechar uma PWA do perfil errado.

## Desenvolvimento e validação

`make test` valida o schema e testa detecção, comandos com espaços, perfis ambíguos e associação de janelas usando GJS/GIO. A integração do painel precisa ser conferida numa sessão GNOME Shell 50. Erros do Shell podem ser consultados com `journalctl --user -b -o cat /usr/bin/gnome-shell`.

APIs: [guia de extensões GJS](https://gjs.guide/extensions/) e [Meta.Window](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Window.html).
