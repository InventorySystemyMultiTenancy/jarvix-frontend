Jarvis Builder

1. Baixe o arquivo JarvisBuilder.zip pelo site.
2. Extraia o ZIP em uma pasta local do computador.
3. Instale o Python 3 pelo site python.org, se ainda nao tiver.
   Durante a instalacao, marque a opcao "Add python.exe to PATH".
4. Execute "Gerar Jarvis.vbs" para abrir a interface grafica sem tela preta.
5. Clique em "Gerar Jarvis" e acompanhe a barra de progresso.
6. O executavel Jarvis ficara dentro da pasta dist\Jarvis.
7. Ao abrir o Jarvis.exe, ele mostra uma interface grafica moderna com chat,
   microfone e resposta por voz. Ele nao roda mais em tela preta de CMD.

Para ativar a IA no Jarvis.exe com seguranca, a chave OPENAI_API_KEY deve ficar
somente no servidor/backend, nunca no Jarvis.exe.

O usuario nao precisa editar .env. Na primeira execucao, o Jarvis.exe pede a URL
da central Jarvis e o login da conta no console. Depois ele salva apenas o token
em C:\JarvisData\config.json e entra automaticamente nas proximas execucoes.
Use a URL do backend publicado, por exemplo https://seu-backend.onrender.com.
http://127.0.0.1:8765 so funciona para desenvolvimento local.

GITHUB_TOKEN e opcional e so deve ser usado se for um token do proprio usuario.

Antes de gerar, deixe pelo menos 4 GB livres no disco C:.
As dependencias do Jarvis sao grandes e o PyInstaller tambem precisa de espaco temporario.

Se o Windows bloquear o VBS, execute gerar_jarvis.bat.
O BAT ainda pode abrir uma tela preta rapidamente, mas ele chama a mesma interface grafica.

Se der erro, a interface salva detalhes em build_jarvis.log na mesma pasta.
Na primeira execucao, a instalacao das dependencias pode demorar alguns minutos.
