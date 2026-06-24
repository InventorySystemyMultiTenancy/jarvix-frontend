Jarvis Builder

1. Baixe o arquivo JarvisBuilder.zip pelo site.
2. Extraia o ZIP em uma pasta local do computador.
3. Instale o Python 3 pelo site python.org, se ainda nao tiver.
   Durante a instalacao, marque a opcao "Add python.exe to PATH".
4. Execute "Gerar Jarvis.vbs" para abrir a interface grafica sem tela preta.
5. Clique em "Gerar Jarvis" e acompanhe a barra de progresso.
6. O executavel Jarvis ficara dentro da pasta dist\Jarvis.

Antes de gerar, deixe pelo menos 4 GB livres no disco C:.
As dependencias do Jarvis sao grandes e o PyInstaller tambem precisa de espaco temporario.

Se o Windows bloquear o VBS, execute gerar_jarvis.bat.
O BAT ainda pode abrir uma tela preta rapidamente, mas ele chama a mesma interface grafica.

Se der erro, a interface salva detalhes em build_jarvis.log na mesma pasta.
Na primeira execucao, a instalacao das dependencias pode demorar alguns minutos.
