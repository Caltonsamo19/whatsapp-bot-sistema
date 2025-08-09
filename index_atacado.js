require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const axios = require('axios'); // npm install axios

// === IMPORTAR A IA ATACADO ===
const WhatsAppAIAtacado = require('./whatsapp_ai_atacado');

// === CONFIGURAÇÃO GOOGLE SHEETS ===
const GOOGLE_SHEETS_CONFIG = {
    scriptUrl: process.env.GOOGLE_SHEETS_URL,
    timeout: 30000
};

console.log(`📊 Google Sheets configurado: ${GOOGLE_SHEETS_CONFIG.scriptUrl}`);

// Criar instância do cliente
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot_atacado" // Diferente do bot retalho
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// === INICIALIZAR A IA ===
require('dotenv').config();
const ia = new WhatsAppAIAtacado(process.env.OPENAI_API_KEY);

// Configuração para encaminhamento
const ENCAMINHAMENTO_CONFIG = {
    grupoOrigem: '120363402160265624@g.us', // Grupo de atacado
    numeroDestino: '258861645968@c.us',
    intervaloSegundos: 2
};

// Fila de mensagens para encaminhar
let filaMensagens = [];
let processandoFila = false;

// === VARIÁVEIS PARA DADOS ===
let dadosParaTasker = [];

// Base de dados de compradores
let historicoCompradores = {};
const ARQUIVO_HISTORICO = 'historico_compradores_atacado.json';

// Cache de administradores dos grupos
let adminCache = {};

// Cache para evitar logs repetidos de grupos
let gruposLogados = new Set();

// Configuração de administradores GLOBAIS
const ADMINISTRADORES_GLOBAIS = [
    '258861645968@c.us',
    '258871112049@c.us', 
    '258852118624@c.us'
];

// === CONFIGURAÇÃO DE MODERAÇÃO ===
const MODERACAO_CONFIG = {
    ativado: {
        '120363402160265624@g.us': true
    },
    detectarLinks: true,
    apagarMensagem: true,
    removerUsuario: true,
    excecoes: [
        '258861645968@c.us',
        '258871112049@c.us', 
        '258852118624@c.us'
    ]
};

// Configuração para cada grupo (ATACADO)
const CONFIGURACAO_GRUPOS = {
    '120363402160265624@g.us': {
        nome: 'Atacado - GB Completos',
        tabela: `GB'S COMPLETOS
📱 10GB➜125MT 
📱 20GB ➜ 250MT  
📱 30GB ➜ 375MT  
📱 40GB ➜ 500MT  
📱 50GB ➜ 625MT  
📱 60GB ➜ 750MT  
📱 70GB ➜ 875MT  
📱 80GB ➜ 1000MT  
📱 90GB ➜ 1125MT  
📱 100GB➜1250MT

💡 *SISTEMA ATACADO - VALOR INTEGRAL*
📞 1 Comprovante = 1 Número = Valor Completo`,

        pagamento: `FORMAS DE PAGAMENTO ATACADO
 
M-PESA❤: 840326152 
E-MOLA🧡: 870059057 
NOME: Vasco José Mahumane 

📝 Após a transferência, mande:
1️⃣ Comprovativo 
2️⃣ UM número que vai receber

⚠️ ATACADO: Valor integral para cada número`
    }
};

// === FUNÇÃO GOOGLE SHEETS ===

// Função para retry automático
async function tentarComRetry(funcao, maxTentativas = 3, delay = 2000) {
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            return await funcao();
        } catch (error) {
            console.log(`⚠️ Tentativa ${tentativa}/${maxTentativas} falhou: ${error.message}`);
            
            if (tentativa === maxTentativas) {
                throw error; // Última tentativa, propagar erro
            }
            
            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function enviarParaGoogleSheets(referencia, valor, numero, grupoId, grupoNome, autorMensagem) {
    const dados = {
        referencia: referencia,
        valor: parseInt(valor),
        numero: numero,
        grupo_id: grupoId, // ID único do grupo
        grupo_nome: grupoNome, // Nome para exibição
        autor: autorMensagem,
        timestamp: new Date().toISOString(),
        processado: false,
        tasker_id: Date.now() + Math.random().toString(36).substr(2, 9),
        bot_type: 'atacado' // Identificar bot atacado
    };
    
    try {
        console.log(`📊 Enviando para Google Sheets [${grupoNome}]: ${referencia}|${valor}|${numero}`);
        
        const response = await axios.post(GOOGLE_SHEETS_CONFIG.scriptUrl, dados, {
            timeout: GOOGLE_SHEETS_CONFIG.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Bot-Source': 'WhatsApp-Bot-Atacado'
            },
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        if (response.data && response.data.success) {
            console.log(`✅ Google Sheets: Dados enviados! Row: ${response.data.row} | Grupo: ${grupoNome}`);
            return { sucesso: true, row: response.data.row };
        } else {
            throw new Error(response.data?.error || 'Resposta inválida');
        }
        
    } catch (error) {
        console.error(`❌ Erro Google Sheets [${grupoNome}]: ${error.message}`);
        return { sucesso: false, erro: error.message };
    }
}

// === FUNÇÃO PRINCIPAL PARA TASKER ===
async function enviarParaTasker(referencia, valor, numero, grupoId, autorMensagem) {
    const grupoNome = getConfiguracaoGrupo(grupoId)?.nome || 'Desconhecido';
    const timestamp = new Date().toLocaleString('pt-BR');
    const linhaCompleta = `${referencia}|${valor}|${numero}`;
    
    console.log(`📊 ENVIANDO PARA GOOGLE SHEETS [${grupoNome}]: ${linhaCompleta}`);
    
    // Armazenar localmente (backup)
    dadosParaTasker.push({
        dados: linhaCompleta,
        grupo_id: grupoId,
        grupo: grupoNome,
        autor: autorMensagem,
        timestamp: timestamp,
        enviado: false,
        metodo: 'pendente',
        bot_type: 'atacado'
    });
    
    // === TENTAR GOOGLE SHEETS PRIMEIRO ===
    const resultado = await enviarParaGoogleSheets(referencia, valor, numero, grupoId, grupoNome, autorMensagem);
    
    if (resultado.sucesso) {
        // Marcar como enviado
        dadosParaTasker[dadosParaTasker.length - 1].enviado = true;
        dadosParaTasker[dadosParaTasker.length - 1].metodo = 'google_sheets';
        dadosParaTasker[dadosParaTasker.length - 1].row = resultado.row;
        console.log(`✅ [${grupoNome}] Enviado para Google Sheets! Row: ${resultado.row}`);
    } else {
        // Fallback para WhatsApp se Google Sheets falhar
        console.log(`🔄 [${grupoNome}] Google Sheets falhou, usando WhatsApp backup...`);
        enviarViaWhatsAppTasker(linhaCompleta, grupoNome, autorMensagem);
        dadosParaTasker[dadosParaTasker.length - 1].metodo = 'whatsapp_backup';
    }
    
    // Backup em arquivo
    await salvarArquivoTasker(linhaCompleta, grupoNome, timestamp);
    
    // Manter apenas últimos 100 registros
    if (dadosParaTasker.length > 100) {
        dadosParaTasker = dadosParaTasker.slice(-100);
    }
    
    return linhaCompleta;
}

function enviarViaWhatsAppTasker(linhaCompleta, grupoNome, autorMensagem) {
    const item = {
        conteudo: linhaCompleta,
        autor: autorMensagem,
        grupo: grupoNome,
        timestamp: Date.now(),
        id: Date.now() + Math.random(),
        tipo: 'tasker_data_backup_atacado'
    };

    filaMensagens.push(item);
    console.log(`📱 WhatsApp Backup → Tasker: ${linhaCompleta}`);

    if (!processandoFila) {
        processarFila();
    }
}

async function salvarArquivoTasker(linhaCompleta, grupoNome, timestamp) {
    try {
        // Arquivo principal para Tasker (apenas a linha)
        await fs.appendFile('tasker_input_atacado.txt', linhaCompleta + '\n');
        
        // Log completo para histórico
        const logLine = `${timestamp} | ${grupoNome} | ${linhaCompleta}\n`;
        await fs.appendFile('tasker_log_atacado.txt', logLine);
        
        console.log(`📁 Arquivo → Backup: ${linhaCompleta}`);
        
    } catch (error) {
        console.error('❌ Erro ao salvar arquivo Tasker:', error);
    }
}

function obterDadosTasker() {
    return dadosParaTasker;
}

function obterDadosTaskerHoje() {
    const hoje = new Date().toDateString();
    return dadosParaTasker.filter(item => {
        const dataItem = new Date(item.timestamp).toDateString();
        return dataItem === hoje;
    });
}

// === FUNÇÕES AUXILIARES ===

function detectarPerguntaPorNumero(mensagem) {
    const texto = mensagem.toLowerCase();
    
    const padroes = [
        /qual\s+(é\s+)?(o\s+)?número/i,
        /número\s+(de\s+)?(contato|suporte|atendimento)/i,
        /como\s+(falar|contactar|entrar em contacto)/i,
        /preciso\s+(de\s+)?(ajuda|suporte|número)/i,
        /onde\s+(posso\s+)?falar/i,
        /tem\s+(número|contacto|suporte)/i,
        /quero\s+falar\s+com/i,
        /atendimento/i,
        /suporte/i,
        /admin/i,
        /administrador/i,
        /responsável/i,
        /quem\s+(é\s+)?responsável/i,
        /como\s+contactar/i,
        /número\s+do\s+admin/i
    ];
    
    return padroes.some(padrao => padrao.test(texto));
}

function isAdministrador(numero) {
    return ADMINISTRADORES_GLOBAIS.includes(numero);
}

function isGrupoMonitorado(chatId) {
    return CONFIGURACAO_GRUPOS.hasOwnProperty(chatId);
}

function getConfiguracaoGrupo(chatId) {
    return CONFIGURACAO_GRUPOS[chatId] || null;
}

async function isAdminGrupo(chatId, participantId) {
    try {
        if (adminCache[chatId] && adminCache[chatId].timestamp > Date.now() - 300000) {
            return adminCache[chatId].admins.includes(participantId);
        }

        const chat = await client.getChatById(chatId);
        const participants = await chat.participants;
        const admins = participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
        
        adminCache[chatId] = {
            admins: admins,
            timestamp: Date.now()
        };

        return admins.includes(participantId);
    } catch (error) {
        console.error('❌ Erro ao verificar admin do grupo:', error);
        return false;
    }
}

function contemConteudoSuspeito(mensagem) {
    const texto = mensagem.toLowerCase();
    const temLink = /(?:https?:\/\/|www\.|\.com|\.net|\.org|\.br|\.mz|bit\.ly|tinyurl|t\.me|wa\.me|whatsapp\.com|telegram\.me|link|url)/i.test(texto);
    
    return {
        temLink: MODERACAO_CONFIG.detectarLinks && temLink,
        suspeito: MODERACAO_CONFIG.detectarLinks && temLink
    };
}

async function deletarMensagem(message) {
    try {
        await message.delete(true);
        console.log(`🗑️ Mensagem deletada`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao deletar mensagem:', error);
        return false;
    }
}

async function removerParticipante(chatId, participantId, motivo) {
    try {
        const chat = await client.getChatById(chatId);
        await chat.removeParticipants([participantId]);
        console.log(`🚫 Participante removido: ${participantId} - ${motivo}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao remover participante:', error);
        return false;
    }
}

async function aplicarModeracao(message, motivoDeteccao) {
    const chatId = message.from;
    const authorId = message.author || message.from;
    
    try {
        if (!MODERACAO_CONFIG.ativado[chatId]) {
            return;
        }

        if (MODERACAO_CONFIG.excecoes.includes(authorId) || isAdministrador(authorId)) {
            return;
        }

        const isAdmin = await isAdminGrupo(chatId, authorId);
        if (isAdmin) {
            return;
        }

        console.log(`🚨 MODERAÇÃO: ${motivoDeteccao}`);

        if (MODERACAO_CONFIG.apagarMensagem) {
            await deletarMensagem(message);
        }

        if (MODERACAO_CONFIG.removerUsuario) {
            await removerParticipante(chatId, authorId, motivoDeteccao);
        }

    } catch (error) {
        console.error('❌ Erro durante moderação:', error);
    }
}

// === DETECÇÃO DE GRUPOS ===
async function logGrupoInfo(chatId, evento = 'detectado') {
    try {
        const chat = await client.getChatById(chatId);
        const isGrupoMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(chatId);
        
        console.log(`\n🔍 ═══════════════════════════════════════`);
        console.log(`📋 GRUPO ${evento.toUpperCase()}`);
        console.log(`🔍 ═══════════════════════════════════════`);
        console.log(`📛 Nome: ${chat.name}`);
        console.log(`🆔 ID: ${chatId}`);
        console.log(`👥 Participantes: ${chat.participants ? chat.participants.length : 'N/A'}`);
        console.log(`📊 Monitorado: ${isGrupoMonitorado ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`⏰ Data: ${new Date().toLocaleString('pt-BR')}`);
        
        if (!isGrupoMonitorado) {
            console.log(`\n🔧 PARA ADICIONAR ESTE GRUPO:`);
            console.log(`📝 Copie este código para CONFIGURACAO_GRUPOS:`);
            console.log(`\n'${chatId}': {`);
            console.log(`    nome: '${chat.name}',`);
            console.log(`    tabela: \`SUA_TABELA_AQUI\`,`);
            console.log(`    pagamento: \`SUAS_FORMAS_DE_PAGAMENTO_AQUI\``);
            console.log(`},\n`);
        }
        
        console.log(`🔍 ═══════════════════════════════════════\n`);
        
        return {
            id: chatId,
            nome: chat.name,
            participantes: chat.participants ? chat.participants.length : 0,
            monitorado: isGrupoMonitorado
        };
        
    } catch (error) {
        console.error(`❌ Erro ao obter informações do grupo ${chatId}:`, error);
        return null;
    }
}

// === HISTÓRICO DE COMPRADORES ===

async function carregarHistorico() {
    try {
        const data = await fs.readFile(ARQUIVO_HISTORICO, 'utf8');
        historicoCompradores = JSON.parse(data);
        console.log('📊 Histórico atacado carregado!');
    } catch (error) {
        console.log('📊 Criando novo histórico atacado...');
        historicoCompradores = {};
    }
}

async function salvarHistorico() {
    try {
        await fs.writeFile(ARQUIVO_HISTORICO, JSON.stringify(historicoCompradores, null, 2));
        console.log('💾 Histórico atacado salvo!');
    } catch (error) {
        console.error('❌ Erro ao salvar histórico:', error);
    }
}

async function registrarComprador(grupoId, numeroComprador, nomeContato, valorTransferencia) {
    const agora = new Date();
    const timestamp = agora.toISOString();

    if (!historicoCompradores[grupoId]) {
        historicoCompradores[grupoId] = {
            nomeGrupo: getConfiguracaoGrupo(grupoId)?.nome || 'Grupo Desconhecido',
            compradores: {}
        };
    }

    if (!historicoCompradores[grupoId].compradores[numeroComprador]) {
        historicoCompradores[grupoId].compradores[numeroComprador] = {
            primeiraCompra: timestamp,
            ultimaCompra: timestamp,
            totalCompras: 1,
            nomeContato: nomeContato,
            historico: []
        };
    } else {
        historicoCompradores[grupoId].compradores[numeroComprador].ultimaCompra = timestamp;
        historicoCompradores[grupoId].compradores[numeroComprador].totalCompras++;
        historicoCompradores[grupoId].compradores[numeroComprador].nomeContato = nomeContato;
    }

    historicoCompradores[grupoId].compradores[numeroComprador].historico.push({
        data: timestamp,
        valor: valorTransferencia
    });

    if (historicoCompradores[grupoId].compradores[numeroComprador].historico.length > 10) {
        historicoCompradores[grupoId].compradores[numeroComprador].historico =
            historicoCompradores[grupoId].compradores[numeroComprador].historico.slice(-10);
    }

    await salvarHistorico();
    console.log(`💰 Comprador atacado registrado: ${nomeContato} (${numeroComprador}) - ${valorTransferencia}MT`);
}

// === FILA DE MENSAGENS ===

function adicionarNaFila(mensagem, autor, nomeGrupo, timestamp) {
    const item = {
        conteudo: mensagem,
        autor: autor,
        grupo: nomeGrupo,
        timestamp: timestamp,
        id: Date.now() + Math.random()
    };

    filaMensagens.push(item);
    console.log(`📥 Adicionado à fila: ${filaMensagens.length} mensagens`);

    if (!processandoFila) {
        processarFila();
    }
}

async function processarFila() {
    if (processandoFila || filaMensagens.length === 0) {
        return;
    }

    processandoFila = true;
    console.log(`🚀 Processando ${filaMensagens.length} mensagens...`);

    while (filaMensagens.length > 0) {
        const item = filaMensagens.shift();

        try {
            await client.sendMessage(ENCAMINHAMENTO_CONFIG.numeroDestino, item.conteudo);
            console.log(`✅ Encaminhado: ${item.conteudo.substring(0, 50)}...`);

            if (filaMensagens.length > 0) {
                await new Promise(resolve => setTimeout(resolve, ENCAMINHAMENTO_CONFIG.intervaloSegundos * 1000));
            }

        } catch (error) {
            console.error(`❌ Erro ao encaminhar:`, error);
            filaMensagens.unshift(item);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    processandoFila = false;
    console.log(`🎉 Fila processada!`);
}

// === EVENTOS DO BOT ===

client.on('qr', (qr) => {
    console.log('📱 BOT ATACADO - Escaneie o QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ Bot ATACADO conectado e pronto!');
    console.log('🧠 IA WhatsApp ATACADO ativa!');
    console.log('📦 Sistema simplificado: Valor integral por número!');
    console.log('📊 Google Sheets configurado!');
    console.log(`🔗 URL: ${GOOGLE_SHEETS_CONFIG.scriptUrl}`);
    
    await carregarHistorico();
    
    console.log('\n🤖 Monitorando grupos ATACADO:');
    Object.keys(CONFIGURACAO_GRUPOS).forEach(grupoId => {
        const config = CONFIGURACAO_GRUPOS[grupoId];
        console.log(`   📋 ${config.nome} (${grupoId})`);
    });
    
    console.log('\n🔧 Comandos admin: .ia .stats .sheets .test_sheets .test_grupo .grupos_status .grupos .grupo_atual');
});

client.on('group-join', async (notification) => {
    try {
        const chatId = notification.chatId;
        
        // Detectar se o bot foi adicionado
        const addedParticipants = notification.recipientIds || [];
        const botInfo = client.info;
        
        if (botInfo && addedParticipants.includes(botInfo.wid._serialized)) {
            console.log(`\n🤖 BOT ATACADO ADICIONADO A UM NOVO GRUPO!`);
            await logGrupoInfo(chatId, 'BOT ATACADO ADICIONADO');
            
            setTimeout(async () => {
                try {
                    const isMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(chatId);
                    const mensagem = isMonitorado ? 
                        `🤖 *BOT ATACADO ATIVO E CONFIGURADO!*\n\nEste grupo está monitorado e o sistema automático já está funcionando.\n\n📋 Digite: *tabela* (ver preços)\n💳 Digite: *pagamento* (ver formas)\n\n⚠️ *ATACADO: Valor integral por número*` :
                        `🤖 *BOT ATACADO CONECTADO!*\n\n⚙️ Este grupo ainda não está configurado.\n🔧 Contacte o administrador para ativação.\n\n📝 ID do grupo copiado no console do servidor.`;
                    
                    await client.sendMessage(chatId, mensagem);
                    console.log(`✅ Mensagem de status enviada`);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem de status:', error);
                }
            }, 3000);
        }
        
        // Código original do grupo já configurado
        const configGrupo = getConfiguracaoGrupo(chatId);
        if (configGrupo) {
            console.log(`👋 Novo membro no grupo ${configGrupo.nome}`);
            
            const mensagemBoasVindas = `
🤖 *SISTEMA ATACADO - VALOR INTEGRAL* 

Bem-vindo(a) ao *${configGrupo.nome}*! 

✨ *Aqui usamos sistema atacado!*

🛒 *Como comprar:*
1️⃣ Faça o pagamento 
2️⃣ Envie comprovante + UM número
3️⃣ Receba valor INTEGRAL no número!

📋 Digite: *tabela* (ver preços)
💳 Digite: *pagamento* (ver formas)

⚡ *Valor completo por número!*
            `;
            
            setTimeout(async () => {
                try {
                    await client.sendMessage(chatId, mensagemBoasVindas);
                    console.log(`✅ Mensagem de boas-vindas enviada`);
                } catch (error) {
                    console.error('❌ Erro ao enviar boas-vindas:', error);
                }
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Erro no evento group-join:', error);
    }
});

client.on('message', async (message) => {
    try {
        const isPrivado = !message.from.endsWith('@g.us');
        const isAdmin = isAdministrador(message.from);

        // === COMANDOS ADMINISTRATIVOS ===
        if (isAdmin) {
            const comando = message.body.toLowerCase().trim();

            if (comando === '.ia') {
                const statusIA = ia.getStatusDetalhado();
                await message.reply(statusIA);
                console.log(`🧠 Comando .ia executado`);
                return;
            }

            if (comando === '.stats') {
                let stats = `📊 *ESTATÍSTICAS ATACADO*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                
                Object.keys(CONFIGURACAO_GRUPOS).forEach(grupoId => {
                    const config = CONFIGURACAO_GRUPOS[grupoId];
                    const dados = historicoCompradores[grupoId];
                    const totalCompradores = dados ? Object.keys(dados.compradores || {}).length : 0;
                    
                    if (totalCompradores > 0) {
                        stats += `🏢 *${config.nome}*\n`;
                        stats += `👥 ${totalCompradores} compradores\n\n`;
                    }
                });
                
                await message.reply(stats);
                return;
            }

            // === COMANDOS GOOGLE SHEETS ===
            if (comando === '.test_sheets') {
                console.log(`🧪 Testando Google Sheets...`);
                
                const resultado = await enviarParaGoogleSheets('TEST123', '1250', '842223344', 'test_group', 'Teste Admin Atacado', 'TestUser');
                
                if (resultado.sucesso) {
                    await message.reply(`✅ *Google Sheets funcionando!*\n\n📊 URL: ${GOOGLE_SHEETS_CONFIG.scriptUrl}\n📝 Row: ${resultado.row}\n🎉 Dados enviados com sucesso!`);
                } else {
                    await message.reply(`❌ *Google Sheets com problema!*\n\n📊 URL: ${GOOGLE_SHEETS_CONFIG.scriptUrl}\n⚠️ Erro: ${resultado.erro}\n\n🔧 *Verifique:*\n• Script publicado corretamente\n• Permissões do Google Sheets\n• Internet funcionando`);
                }
                return;
            }

            if (comando === '.test_grupo') {
                const grupoAtual = message.from;
                const configGrupo = getConfiguracaoGrupo(grupoAtual);
                
                if (!configGrupo) {
                    await message.reply('❌ Este grupo não está configurado!');
                    return;
                }
                
                console.log(`🧪 Testando Google Sheets para grupo: ${configGrupo.nome}`);
                
                const resultado = await enviarParaGoogleSheets('TEST999', '1250', '847777777', grupoAtual, configGrupo.nome, 'TestAdmin');
                
                if (resultado.sucesso) {
                    await message.reply(`✅ *Teste enviado para ${configGrupo.nome}!*\n\n📊 Row: ${resultado.row}\n🔍 O celular deste grupo deve processar em até 30 segundos.\n\n📱 *Grupo ID:* \`${grupoAtual}\``);
                } else {
                    await message.reply(`❌ *Erro no teste:* ${resultado.erro}`);
                }
                return;
            }

            if (comando === '.grupos_status') {
                let resposta = `📊 *STATUS DOS GRUPOS ATACADO*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                
                for (const [grupoId, config] of Object.entries(CONFIGURACAO_GRUPOS)) {
                    const dadosGrupo = dadosParaTasker.filter(d => d.grupo_id === grupoId);
                    const hoje = dadosGrupo.filter(d => {
                        const dataItem = new Date(d.timestamp).toDateString();
                        return dataItem === new Date().toDateString();
                    });
                    
                    resposta += `🏢 *${config.nome}*\n`;
                    resposta += `   📈 Total: ${dadosGrupo.length}\n`;
                    resposta += `   📅 Hoje: ${hoje.length}\n`;
                    resposta += `   📊 Sheets: ${dadosGrupo.filter(d => d.metodo === 'google_sheets').length}\n`;
                    resposta += `   📱 Backup: ${dadosGrupo.filter(d => d.metodo === 'whatsapp_backup').length}\n`;
                    resposta += `   🆔 ID: \`${grupoId}\`\n\n`;
                }
                
                await message.reply(resposta);
                return;
            }

            if (comando === '.sheets') {
                const dados = obterDadosTasker();
                const hoje = obterDadosTaskerHoje();
                const sheets = dados.filter(d => d.metodo === 'google_sheets').length;
                const whatsapp = dados.filter(d => d.metodo === 'whatsapp_backup').length;
                
                let resposta = `📊 *GOOGLE SHEETS STATUS ATACADO*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                resposta += `📈 Total enviado: ${dados.length}\n`;
                resposta += `📅 Hoje: ${hoje.length}\n`;
                resposta += `📊 Via Google Sheets: ${sheets}\n`;
                resposta += `📱 Via WhatsApp: ${whatsapp}\n`;
                resposta += `📱 Fila atual: ${filaMensagens.length}\n\n`;
                
                if (dados.length > 0) {
                    resposta += `📋 *Últimos 5 enviados:*\n`;
                    dados.slice(-5).forEach((item, index) => {
                        const metodo = item.metodo === 'google_sheets' ? '📊' : '📱';
                        resposta += `${index + 1}. ${metodo} ${item.dados} (${item.grupo})\n`;
                    });
                }
                
                await message.reply(resposta);
                return;
            }

            if (comando.startsWith('.clear_grupo ')) {
                const nomeGrupo = comando.replace('.clear_grupo ', '');
                const antes = dadosParaTasker.length;
                
                dadosParaTasker = dadosParaTasker.filter(d => !d.grupo.toLowerCase().includes(nomeGrupo.toLowerCase()));
                
                const removidos = antes - dadosParaTasker.length;
                await message.reply(`🗑️ *${removidos} registros do grupo "${nomeGrupo}" removidos!*`);
                return;
            }

            if (comando === '.clear_sheets') {
                dadosParaTasker = [];
                await message.reply('🗑️ *Dados do Google Sheets atacado limpos!*');
                return;
            }

            // === COMANDOS PARA DETECÇÃO DE GRUPOS ===
            if (comando === '.grupos') {
                try {
                    let resposta = `📋 *GRUPOS DETECTADOS ATACADO*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                    
                    const chats = await client.getChats();
                    const grupos = chats.filter(chat => chat.isGroup);
                    
                    resposta += `📊 Total de grupos: ${grupos.length}\n\n`;
                    
                    for (const grupo of grupos) {
                        const isMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(grupo.id._serialized);
                        const status = isMonitorado ? '✅' : '❌';
                        
                        resposta += `${status} *${grupo.name}*\n`;
                        resposta += `   🆔 \`${grupo.id._serialized}\`\n`;
                        resposta += `   👥 ${grupo.participants.length} membros\n\n`;
                    }
                    
                    resposta += `\n🔧 *Para adicionar grupo:*\nCopie ID e adicione em CONFIGURACAO_GRUPOS`;
                    
                    await message.reply(resposta);
                    
                    console.log(`\n📋 COMANDO .grupos executado - ${grupos.length} grupos encontrados`);
                    grupos.forEach(grupo => {
                        const isMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(grupo.id._serialized);
                        console.log(`${isMonitorado ? '✅' : '❌'} ${grupo.name}: ${grupo.id._serialized}`);
                    });
                    
                } catch (error) {
                    console.error('❌ Erro ao listar grupos:', error);
                    await message.reply('❌ Erro ao obter lista de grupos');
                }
                return;
            }

            if (comando === '.grupo_atual') {
                if (!message.from.endsWith('@g.us')) {
                    await message.reply('❌ Use este comando em um grupo!');
                    return;
                }
                
                await logGrupoInfo(message.from, 'COMANDO .grupo_atual');
                
                const configGrupo = getConfiguracaoGrupo(message.from);
                const status = configGrupo ? '✅ CONFIGURADO' : '❌ NÃO CONFIGURADO';
                
                await message.reply(
                    `📋 *INFORMAÇÕES DESTE GRUPO ATACADO*\n\n` +
                    `🆔 ID: \`${message.from}\`\n` +
                    `📊 Status: ${status}\n\n` +
                    `${configGrupo ? `🏢 Nome: ${configGrupo.nome}` : '🔧 Precisa ser configurado'}\n\n` +
                    `📝 Verifique o console para detalhes completos`
                );
                return;
            }
        }

        // === DETECÇÃO DE GRUPOS NÃO CONFIGURADOS ===
        if (message.from.endsWith('@g.us') && !isGrupoMonitorado(message.from) && !message.fromMe) {
            if (!gruposLogados.has(message.from)) {
                await logGrupoInfo(message.from, 'MENSAGEM RECEBIDA');
                gruposLogados.add(message.from);
                
                // Limpar cache a cada 50 grupos para evitar memory leak
                if (gruposLogados.size > 50) {
                    gruposLogados.clear();
                }
            }
        }

        // === PROCESSAMENTO DE GRUPOS ===
        if (!message.from.endsWith('@g.us') || !isGrupoMonitorado(message.from)) {
            return;
        }

        const configGrupo = getConfiguracaoGrupo(message.from);
        if (!configGrupo || message.fromMe) {
            return;
        }

        // === MODERAÇÃO ===
        if (message.type === 'chat') {
            const analise = contemConteudoSuspeito(message.body);
            
            if (analise.suspeito) {
                console.log(`🚨 Conteúdo suspeito detectado`);
                await aplicarModeracao(message, "Link detectado");
                return;
            }
        }

        // === PROCESSAMENTO DE IMAGENS ===
        if (message.type === 'image') {
            console.log(`📸 Imagem recebida`);
            
            try {
                const media = await message.downloadMedia();
                
                if (!media || !media.data) {
                    throw new Error('Falha ao baixar imagem');
                }
                
                const remetente = message.author || message.from;
                const legendaImagem = message.body || null;
                
                if (legendaImagem) {
                    console.log(`📝 Legenda da imagem detectada: ${legendaImagem.substring(0, 50)}...`);
                }
                
                const resultadoIA = await ia.processarMensagemBot(media.data, remetente, 'imagem', configGrupo, legendaImagem);
                
                if (resultadoIA.sucesso) {
                    
                    if (resultadoIA.tipo === 'comprovante_imagem_recebido') {
                        await message.reply(
                            `✅ *Comprovante da imagem processado!*\n\n` +
                            `💰 Referência: ${resultadoIA.referencia}\n` +
                            `💵 Valor: ${resultadoIA.valor}MT\n\n` +
                            `📱 *Agora envie UM número que vai receber os ${resultadoIA.valor}MT em megas!*`
                        );
                        return;
                        
                    } else if (resultadoIA.tipo === 'numero_processado') {
                        const dadosCompletos = resultadoIA.dadosCompletos;
                        const [referencia, valor, numero] = dadosCompletos.split('|');
                        const nomeContato = message._data.notifyName || 'N/A';
                        const autorMensagem = message.author || 'Desconhecido';
                        
                        await enviarParaTasker(referencia, valor, numero, message.from, autorMensagem);
                        await registrarComprador(message.from, numero, nomeContato, valor);
                        
                        if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
                            const timestampMensagem = new Date().toLocaleString('pt-BR');
                            adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
                        }
                        
                        await message.reply(
                            `✅ *Screenshot + Número processados!*\n\n` +
                            `💰 Referência: ${referencia}\n` +
                            `💵 Valor: ${valor}MT\n` +
                            `📱 Número: ${numero}\n\n` +
                            `📊 Enviado para Google Sheets!\n\n` +
                            `⏳ *Processando valor integral...*`
                        );
                        return;
                    }
                } else {
                    await message.reply(
                        `❌ *Não consegui processar o comprovante da imagem!*\n\n` +
                        `📝 Envie o comprovante como texto.`
                    );
                }
                
            } catch (error) {
                console.error('❌ Erro ao processar imagem:', error);
                await message.reply(`❌ *Erro ao processar imagem!* Envie como texto.`);
            }
            
            return;
        }

        if (message.type !== 'chat') {
            return;
        }

        // Comandos de tabela e pagamento
        if (/tabela/i.test(message.body)) {
            await message.reply(configGrupo.tabela);
            return;
        }

        if (/pagamento/i.test(message.body)) {
            await message.reply(configGrupo.pagamento);
            return;
        }

        // === DETECÇÃO DE PERGUNTA POR NÚMERO (NÃO-ADMIN) ===
        if (!isAdmin && detectarPerguntaPorNumero(message.body)) {
            console.log(`📱 Pergunta por número detectada de não-admin`);
            await message.reply(
                `📱 *Para solicitar número ou suporte:*\n\n` +
                `💳 *Primeiro faça o pagamento:*\n\n` +
                `${configGrupo.pagamento}\n\n` +
                `📝 *Depois envie:*\n` +
                `• Comprovante de pagamento\n` +
                `• UM número que vai receber\n\n` +
                `🤖 *Sistema atacado - valor integral!*`
            );
            return;
        }

        // === PROCESSAMENTO COM IA ===
        const remetente = message.author || message.from;
        const resultadoIA = await ia.processarMensagemBot(message.body, remetente, 'texto', configGrupo);
        
        if (resultadoIA.erro) {
            console.error(`❌ Erro na IA:`, resultadoIA.mensagem);
            return;
        }

        if (resultadoIA.sucesso) {
            
            if (resultadoIA.tipo === 'comprovante_recebido') {
                await message.reply(
                    `✅ *Comprovante processado!*\n\n` +
                    `💰 Referência: ${resultadoIA.referencia}\n` +
                    `💵 Valor: ${resultadoIA.valor}MT\n\n` +
                    `📱 *Envie UM número que vai receber os ${resultadoIA.valor}MT em megas!*`
                );
                return;
                
            } else if (resultadoIA.tipo === 'numero_processado') {
                const dadosCompletos = resultadoIA.dadosCompletos;
                const [referencia, valor, numero] = dadosCompletos.split('|');
                const nomeContato = message._data.notifyName || 'N/A';
                const autorMensagem = message.author || 'Desconhecido';
                
                await enviarParaTasker(referencia, valor, numero, message.from, autorMensagem);
                await registrarComprador(message.from, numero, nomeContato, valor);
                
                if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
                    const timestampMensagem = new Date().toLocaleString('pt-BR');
                    adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
                }
                
                await message.reply(
                    `✅ *Pedido processado!*\n\n` +
                    `💰 Referência: ${referencia}\n` +
                    `💵 Valor: ${valor}MT\n` +
                    `📱 Número: ${numero}\n\n` +
                    `📊 Enviado para Google Sheets!\n\n` +
                    `⏳ *Processando valor integral...*`
                );
                return;
            }
        }

        // === TRATAMENTO DE ERROS/CASOS ESPECIAIS ===
        if (resultadoIA.tipo === 'numero_sem_comprovante') {
            await message.reply(
                `📱 *Número detectado*\n\n` +
                `❌ Não encontrei seu comprovante.\n\n` +
                `📝 Envie primeiro o comprovante de pagamento.`
            );
            return;
            
        } else if (resultadoIA.tipo === 'multiplos_numeros_nao_permitido') {
            await message.reply(
                `📱 *${resultadoIA.numeros.length} números detectados*\n\n` +
                `❌ Sistema atacado aceita apenas UM número por vez.\n\n` +
                `📝 Envie apenas um número para receber o valor integral.`
            );
            return;
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

client.on('disconnected', (reason) => {
    console.log('❌ Bot atacado desconectado:', reason);
});

// === INICIALIZAÇÃO ===
client.initialize();

// Salvar histórico a cada 5 minutos
setInterval(salvarHistorico, 5 * 60 * 1000);

// Limpar dados antigos do Tasker a cada hora
setInterval(() => {
    if (dadosParaTasker.length > 200) {
        dadosParaTasker = dadosParaTasker.slice(-100);
        console.log('🗑️ Dados antigos do Tasker atacado removidos');
    }
}, 60 * 60 * 1000);

// Limpar cache de grupos logados a cada 2 horas
setInterval(() => {
    gruposLogados.clear();
    console.log('🗑️ Cache de grupos detectados limpo');
}, 2 * 60 * 60 * 1000);

process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
});

process.on('SIGINT', async () => {
    console.log('\n💾 Salvando antes de sair...');
    await salvarHistorico();
    
    // Salvar dados finais do Tasker
    if (dadosParaTasker.length > 0) {
        const dadosFinais = dadosParaTasker.map(d => d.dados).join('\n');
        await fs.writeFile('tasker_backup_final_atacado.txt', dadosFinais);
        console.log('💾 Backup final do Tasker atacado salvo!');
    }
    
    console.log('🧠 IA: ATIVA');
    console.log('📦 Sistema atacado: VALOR INTEGRAL');
    console.log('📊 Google Sheets: CONFIGURADO');
    console.log(`🔗 URL: ${GOOGLE_SHEETS_CONFIG.scriptUrl}`);
    console.log(ia.getStatus());
    process.exit(0);
});