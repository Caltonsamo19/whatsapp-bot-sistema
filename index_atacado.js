require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const axios = require('axios'); // npm install axios

// === IMPORTAR A IA ATACADO ===
const WhatsAppAIAtacado = require('./whatsapp_ai_atacado');

// === IMPORTAR O BOT DE DIVISÃO ===
const WhatsAppBotDivisao = require('./whatsapp_bot_divisao');

// === CONFIGURAÇÃO GOOGLE SHEETS - BOT ATACADO (CONFIGURADA) ===
const GOOGLE_SHEETS_CONFIG_ATACADO = {
    scriptUrl: process.env.GOOGLE_SHEETS_SCRIPT_URL_ATACADO || 'https://script.google.com/macros/s/AKfycbzdvM-IrH4a6gS53WZ0J-AGXY0duHfgv15DyxdqUm1BLEm3Z15T67qgstu6yPTedgOSCA/exec',
    planilhaUrl: 'https://docs.google.com/spreadsheets/d/1ivc8gHD5WBWsvcwmK2dLBWpEHCI9J0C17Kog2NesuuE/edit',
    planilhaId: '1ivc8gHD5WBWsvcwmK2dLBWpEHCI9J0C17Kog2NesuuE',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000
};

// === CONFIGURAÇÃO GOOGLE SHEETS - BOT RETALHO (mantida para compatibilidade) ===
const GOOGLE_SHEETS_CONFIG = {
    scriptUrl: process.env.GOOGLE_SHEETS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbz.../exec',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000,
    planilhaId: process.env.GOOGLE_SHEETS_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    nomePlanilha: 'Dados Retalho',
    colunas: {
        timestamp: 'A',
        referencia: 'B',
        valor: 'C',
        numero: 'D',
        grupo: 'E',
        autor: 'F',
        status: 'G'
    }
};

console.log(`📊 Google Sheets configurado: ${GOOGLE_SHEETS_CONFIG_ATACADO.scriptUrl}`);

// Criar instância do cliente
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot_atacado" // Diferente do bot retalho
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
        ],
        timeout: 60000
    }
});

// === INICIALIZAR A IA ===
require('dotenv').config();
const ia = new WhatsAppAIAtacado(process.env.OPENAI_API_KEY);

// === INICIALIZAR O BOT DE DIVISÃO ===
const botDivisao = new WhatsAppBotDivisao();

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
    removerUsuario: false,
    excecoes: [
        '258861645968@c.us',
        '258871112049@c.us', 
        '258852118624@c.us'
    ]
};

// === CONFIGURAÇÃO DOS GRUPOS PARA O BOT DE DIVISÃO ===
// Esta configuração deve estar sincronizada com CONFIGURACAO_GRUPOS
const CONFIGURACAO_GRUPOS_DIVISAO = {
    '120363419652375064@g.us': {
        nome: 'Net Fornecedor V',
        precos: {
            10240: 125,    // 10GB = 125MT
            20480: 250,    // 20GB = 250MT
            30720: 375,    // 30GB = 375MT
            40960: 500,    // 40GB = 500MT
            51200: 625,    // 50GB = 625MT
            61440: 750,    // 60GB = 750MT
            71680: 875,    // 70GB = 875MT
            81920: 1000,   // 80GB = 1000MT
            92160: 1125,   // 90GB = 1125MT
            102400: 1250   // 100GB = 1250MT
        }
    },
    '120363402160265624@g.us': {
        nome: 'Treinamento IA',
        precos: {
            10240: 130,    // 10GB = 130MT
            20480: 260,    // 20GB = 260MT
            30720: 390,    // 30GB = 390MT
            40960: 520,    // 40GB = 520MT
            51200: 630,    // 50GB = 630MT
            61440: 750,    // 60GB = 750MT
            71680: 875,    // 70GB = 875MT
            81920: 1000    // 80GB = 1000MT
        }
    }
    // Only Saldo foi removido pois não precisa de divisão automática
};

// Atualizar a configuração do bot de divisão
botDivisao.CONFIGURACAO_GRUPOS = CONFIGURACAO_GRUPOS_DIVISAO;

// Configuração para cada grupo (ATACADO)
const CONFIGURACAO_GRUPOS = {
    '120363419652375064@g.us': {
        nome: 'Net Fornecedor V',
        // CORREÇÃO: Adicionar preços estruturados para cálculo correto de megas
        precos: {
            10240: 125,    // 10GB = 125MT
            20480: 250,    // 20GB = 250MT
            30720: 375,    // 30GB = 375MT
            40960: 500,    // 40GB = 500MT
            51200: 625,    // 50GB = 625MT
            61440: 750,    // 60GB = 750MT
            71680: 875,    // 70GB = 875MT
            81920: 1000,   // 80GB = 1000MT
            92160: 1125,   // 90GB = 1125MT
            102400: 1250   // 100GB = 1250MT
        },
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

📞 1 Comprovante = 1 Número = Valor Completo`,

        pagamento: `FORMAS DE PAGAMENTO
 
M-PESA❤: 840326152 
E-MOLA🧡: 870059057 
NOME: Vasco José Mahumane 

📝 Após a transferência, mande:
1️⃣ Comprovativo 
2️⃣ UM número que vai receber`
    },
    '120363419741642342@g.us': {
        nome: 'Only Saldo',
        tabela: `SALDO PROMO 1K🟰815📞
    
 📞 50      💫 45     MT
 📞 100    💫 85     MT
📞 200     💫 170   MT
📞 300     💫 255   MT
📞 400     💫 340   MT
📞 500     💫 410   MT 
📞 1000   💫 815   MT
📞 2000   💫 1630 MT
📞 3000   💫 2445 MT
📞 4000   💫 3260 MT
📞 5000   💫 4075 MT
📞 6000   💫 4890 MT
📞 7000   💫 5705 MT
📞 8000   💫 6520 MT
📞 9000   💫 7335 MT
📞 10000 💫 8150 MT

📩 Após o envio do valor, mande o compravativo no grupo e o respectivo número beneficiário.`,

        pagamento: `FORMAS DE PAGAMENTO
 
M-PESA❤: 840326152 
E-MOLA🧡: 870059057 
NOME: Vasco José Mahumane 

📝 Após a transferência, mande:
1️⃣ Comprovativo 
2️⃣ UM número que vai receber`
    },
    '120363402160265624@g.us': {
        nome: 'Treinamento IA',
        precos: {
            10240: 130,    // 10GB = 130MT
            20480: 260,    // 20GB = 260MT
            30720: 390,    // 30GB = 390MT
            40960: 520,    // 40GB = 520MT
            51200: 630,    // 50GB = 630MT
            61440: 750,    // 60GB = 750MT
            71680: 875,    // 70GB = 875MT
            81920: 1000    // 80GB = 1000MT
        },
        tabela: `🚨PROMOÇÃO DE GIGABYTES🚨
MAIS DE 40 GIGABYTES 12.5
Oferecemos-lhe serviços extremamente rápido e seguro.🥳
🛜📶 TABELA NORMAL🌐
♨ GB's🛜 COMPLETOS🔥
🌐 10GB  🔰   130MT💳
🌐 20GB  🔰   260MT💳
🌐 30GB  🔰   390MT💳
🌐 40GB  🔰   520MT💳

PACOTE VIP 12.5 24H
🌐 50GB  🔰   630MT💳
🌐 60GB  🔰   750MT💳
🌐 70GB  🔰   875MT💳
🌐 80GB  🔰 1000MT💳

SINTAM-SE AVONTADE, EXPLOREM-NOS ENQUANTO PUDEREM!`,

        pagamento: `FORMAS DE PAGAMENTO
 
M-PESA❤: 840326152 
E-MOLA🧡: 870059057 
NOME: Vasco José Mahumane 

📝 Após a transferência, mande:
1️⃣ Comprovativo 
2️⃣ UM número que vai receber`
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

// === FUNÇÃO GOOGLE SHEETS SIMPLIFICADA ===
async function enviarParaGoogleSheets(dadosCompletos, grupoId, timestamp) {
    const dados = {
        grupo_id: grupoId,
        timestamp: timestamp,
        dados: dadosCompletos  // REF|MEGAS|NUMERO|TIMESTAMP como string única
    };
    
    try {
        console.log(`📊 Enviando para Google Sheets SIMPLIFICADO: ${dadosCompletos}`);
        console.log(`📍 Grupo: ${grupoId}`);
        console.log(`⏰ Timestamp: ${timestamp}`);
        
        const response = await axios.post(GOOGLE_SHEETS_CONFIG_ATACADO.scriptUrl, dados, {
            timeout: GOOGLE_SHEETS_CONFIG_ATACADO.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Bot-Source': 'WhatsApp-Bot-Atacado-Simplificado'
            },
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        // Log detalhado da resposta para debug
        console.log(`🔍 DEBUG Google Sheets Response:`, {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            dataType: typeof response.data,
            hasSuccess: response.data?.success,
            hasError: response.data?.error
        });
        
        if (response.data && response.data.success) {
            console.log(`✅ Google Sheets: Dados enviados! Row: ${response.data.row}`);
            console.log(`📋 Dados inseridos: ${response.data.dados}`);
            return { sucesso: true, row: response.data.row };
        } else if (response.data && response.data.duplicado) {
            // Caso especial: Pagamento duplicado
            console.log(`⚠️ Google Sheets: Pagamento duplicado - ${response.data.referencia}`);
            return { 
                sucesso: false, 
                duplicado: true, 
                referencia: response.data.referencia,
                erro: `Pagamento duplicado: ${response.data.referencia}` 
            };
        } else {
            const errorMsg = response.data?.error || `Resposta inválida: ${JSON.stringify(response.data)}`;
            throw new Error(errorMsg);
        }
        
    } catch (error) {
        console.error(`❌ Erro Google Sheets: ${error.message}`);
        return { sucesso: false, erro: error.message };
    }
}

// === FUNÇÃO PARA NORMALIZAR VALORES (remove vírgulas e converte) ===
function normalizarValor(valor) {
    if (typeof valor === 'number') {
        return valor;
    }
    
    if (typeof valor === 'string') {
        let valorLimpo = valor.trim();
        
        // Casos especiais: valores com múltiplos zeros após vírgula (ex: "1,0000" = 1000MT)
        // Padrão: número seguido de vírgula e só zeros
        const regexZerosAposVirgula = /^(\d+),0+$/;
        const matchZeros = valorLimpo.match(regexZerosAposVirgula);
        if (matchZeros) {
            // "1,0000" significa 1000 meticais (vírgula + zeros = multiplicador de milhares)
            const baseNumero = parseInt(matchZeros[1]);
            const numeroZeros = valorLimpo.split(',')[1].length;
            // Para "1,0000": base=1, zeros=4, então 1 * 1000 = 1000
            const multiplicador = numeroZeros >= 3 ? 1000 : Math.pow(10, numeroZeros);
            return baseNumero * multiplicador;
        }
        
        // Detectar se vírgula é separador de milhares ou decimal
        const temVirgulaSeguida3Digitos = /,\d{3}($|\D)/.test(valorLimpo);
        
        if (temVirgulaSeguida3Digitos) {
            // Vírgula como separador de milhares: "1,000" ou "10,500.50"
            valorLimpo = valorLimpo.replace(/,(?=\d{3}($|\D))/g, '');
        } else {
            // Vírgula como separador decimal: "1,50" → "1.50"
            valorLimpo = valorLimpo.replace(',', '.');
        }
        
        const valorNumerico = parseFloat(valorLimpo);
        
        if (isNaN(valorNumerico)) {
            console.warn(`⚠️ Valor não pôde ser normalizado: "${valor}"`);
            return valor;
        }
        
        // Retorna inteiro se não tem decimais significativos
        return (Math.abs(valorNumerico % 1) < 0.0001) ? Math.round(valorNumerico) : valorNumerico;
    }
    
    return valor;
}

// === FUNÇÃO PARA VERIFICAR PAGAMENTO (reutiliza mesma lógica da divisão) ===
async function verificarPagamentoIndividual(referencia, valorEsperado) {
    try {
        // Normalizar valor antes da verificação
        const valorNormalizado = normalizarValor(valorEsperado);
        
        console.log(`🔍 INDIVIDUAL: Verificando pagamento ${referencia} - ${valorNormalizado}MT (original: ${valorEsperado})`);
        
        // Usar mesma URL e estrutura do bot de divisão
        const response = await axios.post(botDivisao.SCRIPTS_CONFIG.PAGAMENTOS, {
            action: "buscar_por_referencia",
            referencia: referencia,
            valor: valorNormalizado
        }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.encontrado) {
            console.log(`✅ INDIVIDUAL: Pagamento encontrado!`);
            return true;
        }
        
        console.log(`❌ INDIVIDUAL: Pagamento não encontrado`);
        return false;
        
    } catch (error) {
        console.error(`❌ INDIVIDUAL: Erro ao verificar pagamento:`, error.message);
        return false;
    }
}

// === FUNÇÃO PARA CALCULAR VALOR ESPERADO BASEADO NOS MEGAS ===
function calcularValorEsperadoDosMegas(megas, grupoId) {
    try {
        const configGrupo = getConfiguracaoGrupo(grupoId);
        if (!configGrupo || !configGrupo.precos) {
            console.log(`⚠️ INDIVIDUAL: Grupo ${grupoId} não tem tabela de preços configurada`);
            return null;
        }
        
        // Converter megas para número se for string
        const megasNum = typeof megas === 'string' ? 
            parseInt(megas.replace(/[^\d]/g, '')) : parseInt(megas);
        
        // Buscar o preço correspondente na tabela
        const valorEncontrado = configGrupo.precos[megasNum];
        
        if (valorEncontrado) {
            console.log(`💰 INDIVIDUAL: ${megasNum}MB = ${valorEncontrado}MT`);
            return valorEncontrado;
        }
        
        console.log(`⚠️ INDIVIDUAL: Não encontrou preço para ${megasNum}MB na tabela`);
        return null;
        
    } catch (error) {
        console.error(`❌ INDIVIDUAL: Erro ao calcular valor:`, error);
        return null;
    }
}

// === FUNÇÃO PRINCIPAL PARA TASKER (SEM VERIFICAÇÃO - JÁ VERIFICADO ANTES) ===
async function enviarParaTasker(referencia, megas, numero, grupoId, messageContext = null) {
    const timestamp = new Date().toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    // CRIAR STRING COM TIMESTAMP NO FINAL
    const dadosCompletos = `${referencia}|${megas}|${numero}|${timestamp}`;
    
    const grupoNome = getConfiguracaoGrupo(grupoId)?.nome || 'Desconhecido';
    
    console.log(`📊 ENVIANDO DADOS (PAGAMENTO JÁ VERIFICADO):`);
    console.log(`   📋 Dados: ${dadosCompletos}`);
    console.log(`   📍 Grupo: ${grupoNome} (${grupoId})`);
    console.log(`   ⏰ Timestamp: ${timestamp}`);
    
    // Armazenar localmente (backup)
    dadosParaTasker.push({
        dados: dadosCompletos,
        grupo_id: grupoId,
        grupo: grupoNome,
        timestamp: timestamp,
        enviado: false,
        metodo: 'pendente'
    });
    
    // === ENVIAR PARA GOOGLE SHEETS ===
    const resultado = await enviarParaGoogleSheets(dadosCompletos, grupoId, timestamp);
    
    if (resultado.sucesso) {
        dadosParaTasker[dadosParaTasker.length - 1].enviado = true;
        dadosParaTasker[dadosParaTasker.length - 1].metodo = 'google_sheets';
        dadosParaTasker[dadosParaTasker.length - 1].row = resultado.row;
        console.log(`✅ [${grupoNome}] Enviado para Google Sheets! Row: ${resultado.row}`);
    } else if (resultado.duplicado) {
        // Caso especial: Pagamento duplicado
        console.log(`⚠️ [${grupoNome}] Pagamento DUPLICADO detectado: ${resultado.referencia}`);
        dadosParaTasker[dadosParaTasker.length - 1].metodo = 'duplicado';
        dadosParaTasker[dadosParaTasker.length - 1].status = 'duplicado';
        
        // Notificar no WhatsApp se houver contexto da mensagem
        if (messageContext) {
            try {
                await messageContext.reply(
                    `⚠️ *PAGAMENTO DUPLICADO*\n\n` +
                    `🔍 **Referência:** ${resultado.referencia}\n` +
                    `📋 Este pagamento já foi processado anteriormente\n\n` +
                    `✅ **Não é necessário reenviar**\n` +
                    `💡 O pedido original já está na fila de processamento`
                );
            } catch (error) {
                console.error(`❌ Erro ao enviar notificação de duplicado:`, error);
            }
        }
        
        // ⚠️ PARAR PROCESSAMENTO AQUI - NÃO CONTINUAR
        console.log(`🛑 DIVISÃO: Processamento interrompido devido a duplicado`);
        return null; // Retorna null para indicar que foi duplicado
        
    } else {
        console.log(`🔄 [${grupoNome}] Google Sheets falhou, usando WhatsApp backup...`);
        enviarViaWhatsAppTasker(dadosCompletos, grupoNome);
        dadosParaTasker[dadosParaTasker.length - 1].metodo = 'whatsapp_backup';
    }
    
    await salvarArquivoTasker(dadosCompletos, grupoNome, timestamp);
    
    if (dadosParaTasker.length > 100) {
        dadosParaTasker = dadosParaTasker.slice(-100);
    }
    
    return dadosCompletos;
}

// === FUNÇÃO AUXILIAR PARA CÁLCULO DE MEGAS ===
// Esta função deve ser implementada na classe WhatsAppAIAtacado
// Por enquanto, mantemos apenas a estrutura básica

// === FUNÇÃO PARA CONVERTER MEGAS ===
function converterMegasParaNumero(megas) {
    if (typeof megas === 'string') {
        // Remover espaços e converter para maiúsculas
        const megasLimpo = megas.trim().toUpperCase();
        
        // Padrões de conversão
        const padroes = [
            { regex: /(\d+(?:\.\d+)?)\s*GB?/i, multiplicador: 1024 },
            { regex: /(\d+(?:\.\d+)?)\s*MB?/i, multiplicador: 1 },
            { regex: /(\d+(?:\.\d+)?)\s*KB?/i, multiplicador: 1/1024 },
            { regex: /(\d+(?:\.\d+)?)\s*TB?/i, multiplicador: 1024 * 1024 }
        ];
        
        for (const padrao of padroes) {
            const match = megasLimpo.match(padrao.regex);
            if (match) {
                const numero = parseFloat(match[1]);
                const resultado = Math.round(numero * padrao.multiplicador);
                console.log(`🔄 Conversão: ${megas} → ${resultado} MB`);
                return resultado.toString();
            }
        }
        
        // Se não encontrar padrão, tentar extrair apenas números
        const apenasNumeros = megasLimpo.replace(/[^\d.]/g, '');
        if (apenasNumeros) {
            console.log(`🔄 Conversão direta: ${megas} → ${apenasNumeros} MB`);
            return apenasNumeros;
        }
    }
    
    // Se não conseguir converter, retornar o valor original
    console.log(`⚠️ Não foi possível converter: ${megas}`);
    return megas;
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

// === MIDDLEWARE DE PROTEÇÃO ===
async function withRetry(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (error.message && error.message.includes('Execution context was destroyed')) {
                console.log(`⚠️ Contexto destruído detectado na tentativa ${attempt}/${maxRetries}`);
                
                if (attempt < maxRetries) {
                    console.log(`🔄 Aguardando ${delay}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                    continue;
                }
            }
            
            if (attempt === maxRetries) {
                throw lastError;
            }
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
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

        return await withRetry(async () => {
            const chat = await client.getChatById(chatId);
            if (!chat) {
                console.log(`⚠️ Não foi possível acessar o chat ${chatId}`);
                return false;
            }

            const participants = await chat.participants || [];
            const admins = participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized);
            
            adminCache[chatId] = {
                admins: admins,
                timestamp: Date.now()
            };

            return admins.includes(participantId);
        });
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
        const chat = await withRetry(async () => {
            return await client.getChatById(chatId);
        }).catch(() => {
            console.log(`⚠️ Não foi possível acessar informações do grupo ${chatId}`);
            return null;
        });
        
        if (!chat) {
            return null;
        }

        const isGrupoMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(chatId);
        
        console.log(`\n🔍 ═══════════════════════════════════════`);
        console.log(`📋 GRUPO ${evento.toUpperCase()}`);
        console.log(`🔍 ═══════════════════════════════════════`);
        console.log(`📛 Nome: ${chat.name || 'N/A'}`);
        console.log(`🆔 ID: ${chatId}`);
        console.log(`👥 Participantes: ${chat.participants ? chat.participants.length : 'N/A'}`);
        console.log(`📊 Monitorado: ${isGrupoMonitorado ? '✅ SIM' : '❌ NÃO'}`);
        console.log(`⏰ Data: ${new Date().toLocaleString('pt-BR')}`);
        
        if (!isGrupoMonitorado) {
            console.log(`\n🔧 PARA ADICIONAR ESTE GRUPO:`);
            console.log(`📝 Copie este código para CONFIGURACAO_GRUPOS:`);
            console.log(`\n'${chatId}': {`);
            console.log(`    nome: '${chat.name || 'Nome_do_Grupo'}',`);
            console.log(`    tabela: \`SUA_TABELA_AQUI\`,`);
            console.log(`    pagamento: \`SUAS_FORMAS_DE_PAGAMENTO_AQUI\``);
            console.log(`},\n`);
        }
        
        console.log(`🔍 ═══════════════════════════════════════\n`);
        
        return {
            id: chatId,
            nome: chat.name || 'N/A',
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

async function registrarComprador(grupoId, numeroComprador, nomeContato, megas) {
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
        megas: megas
    });

    if (historicoCompradores[grupoId].compradores[numeroComprador].historico.length > 10) {
        historicoCompradores[grupoId].compradores[numeroComprador].historico =
            historicoCompradores[grupoId].compradores[numeroComprador].historico.slice(-10);
    }

    await salvarHistorico();
    console.log(`💰 Comprador atacado registrado: ${nomeContato} (${numeroComprador}) - ${megas}`);
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
            await withRetry(async () => {
                await client.sendMessage(ENCAMINHAMENTO_CONFIG.numeroDestino, item.conteudo);
            });
            
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
    console.log('✅ Event ready fired! Bot ATACADO conectado e pronto!');
    console.log('🧠 IA WhatsApp ATACADO ativa!');
    console.log('📦 Sistema inteligente: Cálculo automático de megas!');
    console.log('📊 Google Sheets ATACADO configurado!');
    console.log('🔄 Bot de Divisão ATIVO - Múltiplos números automático!');
    console.log(`🔗 URL: ${GOOGLE_SHEETS_CONFIG_ATACADO.scriptUrl}`);
    
    await carregarHistorico();
    
    console.log('\n🤖 Monitorando grupos ATACADO:');
    Object.keys(CONFIGURACAO_GRUPOS).forEach(grupoId => {
        const config = CONFIGURACAO_GRUPOS[grupoId];
        console.log(`   📋 ${config.nome} (${grupoId})`);
    });
    
    console.log('\n🔧 Comandos admin: .ia .divisao .test_busca .stats .sheets .test_sheets .test_grupo .grupos_status .grupos .grupo_atual .debug_grupo');
});

client.on('group-join', async (notification) => {
    try {
        const chatId = notification.chatId;
        
        // Detectar se o bot foi adicionado
        const addedParticipants = notification.recipientIds || [];
        try {
            const botInfo = await client.info;
            
            if (botInfo && addedParticipants.includes(botInfo.wid._serialized)) {
                console.log(`\n🤖 BOT ATACADO ADICIONADO A UM NOVO GRUPO!`);
                await logGrupoInfo(chatId, 'BOT ATACADO ADICIONADO');
            
            setTimeout(async () => {
                try {
                    const isMonitorado = CONFIGURACAO_GRUPOS.hasOwnProperty(chatId);
                    const mensagem = isMonitorado ? 
                        `🤖 *BOT ATACADO ATIVO E CONFIGURADO!*\n\nEste grupo está monitorado e o sistema automático já está funcionando.\n\n📋 Digite: *tabela* (ver preços)\n💳 Digite: *pagamento* (ver formas)\n\n⚠️ *ATACADO: Cálculo automático de megas*` :
                        `🤖 *BOT ATACADO CONECTADO!*\n\n⚙️ Este grupo ainda não está configurado.\n🔧 Contacte o administrador para ativação.\n\n📝 ID do grupo copiado no console do servidor.`;
                    
                    await client.sendMessage(chatId, mensagem);
                    console.log(`✅ Mensagem de status enviada`);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem de status:', error);
                }
            }, 3000);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar info do bot:', error);
        }
        
        // Código original do grupo já configurado
        const configGrupo = getConfiguracaoGrupo(chatId);
        if (configGrupo) {
            console.log(`👋 Novo membro no grupo ${configGrupo.nome}`);
            
            const mensagemBoasVindas = `
�� *SISTEMA ATACADO - CÁLCULO AUTOMÁTICO DE MEGAS* 

Bem-vindo(a) ao *${configGrupo.nome}*! 

✨ *Aqui usamos sistema atacado inteligente!*

🛒 *Como comprar:*
1️⃣ Faça o pagamento 
2️⃣ Envie comprovante + UM número
3️⃣ Sistema calcula megas automaticamente!
4️⃣ Receba megas no número!

📋 Digite: *tabela* (ver preços)
💳 Digite: *pagamento* (ver formas)

⚡ *Cálculo automático baseado na tabela!*
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

            // NOVO COMANDO: Status do bot de divisão
            if (comando === '.divisao') {
                const status = botDivisao.getStatus();
                const resposta = `🔄 *BOT DE DIVISÃO STATUS*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `💾 Comprovativos memorizados: ${status.comprovantesMemorizados}\n` +
                    `⚡ Divisões em processamento: ${status.processandoDivisoes}\n` +
                    `🏢 Grupos configurados: ${status.gruposConfigurados}\n\n` +
                    `✅ Sistema ativo e funcionando!`;
                
                await message.reply(resposta);
                return;
            }
            
            // NOVO COMANDO: Testar busca de pagamento
            if (comando.startsWith('.test_busca ')) {
                const parametros = comando.replace('.test_busca ', '').split(' ');
                if (parametros.length >= 2) {
                    const referencia = parametros[0];
                    const valor = parseFloat(parametros[1]);
                    
                    console.log(`🧪 Testando busca: ${referencia} - ${valor}MT`);
                    
                    const resultado = await botDivisao.buscarPagamentoNaPlanilha(referencia, valor);
                    
                    const resposta = resultado ? 
                        `✅ *PAGAMENTO ENCONTRADO*\n\n🔍 Referência: ${referencia}\n💰 Valor: ${valor}MT` :
                        `❌ *PAGAMENTO NÃO ENCONTRADO*\n\n🔍 Referência: ${referencia}\n💰 Valor: ${valor}MT`;
                    
                    await message.reply(resposta);
                } else {
                    await message.reply('❌ Uso: .test_busca REFERENCIA VALOR\nExemplo: .test_busca CHP4H5DMI1S 375');
                }
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
                
                const resultado = await enviarParaGoogleSheets('TEST123|1250|842223344|' + new Date().toLocaleString('pt-BR'), 'test_group', new Date().toLocaleString('pt-BR'));
                
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
                
                const resultado = await enviarParaGoogleSheets('TEST999|1250|847777777|' + new Date().toLocaleString('pt-BR'), grupoAtual, new Date().toLocaleString('pt-BR'));
                
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

            // NOVO COMANDO: Verificar IDs dos grupos atuais
            if (comando === '.debug_grupo') {
                const grupoInfo = {
                    id: message.from,
                    isGrupo: message.from.endsWith('@g.us'),
                    isMonitorado: isGrupoMonitorado(message.from),
                    configExiste: !!getConfiguracaoGrupo(message.from)
                };
                
                await message.reply(
                    `🔍 *DEBUG GRUPO*\n\n` +
                    `🆔 ID: \`${grupoInfo.id}\`\n` +
                    `📱 É grupo: ${grupoInfo.isGrupo ? '✅' : '❌'}\n` +
                    `📊 Monitorado: ${grupoInfo.isMonitorado ? '✅' : '❌'}\n` +
                    `⚙️ Config existe: ${grupoInfo.configExiste ? '✅' : '❌'}\n\n` +
                    `📋 *Grupos configurados:*\n${Object.keys(CONFIGURACAO_GRUPOS).join('\n')}`
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

        // === COMANDOS BÁSICOS (PARA TODAS AS MENSAGENS) ===
        const textoMensagem = message.body ? message.body.toLowerCase().trim() : '';
        
        if (textoMensagem === 'teste') {
            await message.reply('🤖 Bot funcionando normalmente!');
            return;
        }
        
        if (textoMensagem === 'tabela') {
            const configGrupoBasico = getConfiguracaoGrupo(message.from);
            if (configGrupoBasico && configGrupoBasico.tabela) {
                await message.reply(configGrupoBasico.tabela);
            } else {
                await message.reply('❌ Tabela não configurada para este grupo.');
            }
            return;
        }
        
        if (textoMensagem === 'pagamento') {
            const configGrupoBasico = getConfiguracaoGrupo(message.from);
            if (configGrupoBasico && configGrupoBasico.pagamento) {
                await message.reply(configGrupoBasico.pagamento);
            } else {
                await message.reply('❌ Informações de pagamento não configuradas para este grupo.');
            }
            return;
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
            console.log(`�� Imagem recebida`);
            
            try {
                const media = await message.downloadMedia();
                
                if (!media || !media.data) {
                    throw new Error('Falha ao baixar imagem');
                }
                
                const legendaImagem = message.body || null;
                
                if (legendaImagem) {
                    console.log(`📝 Legenda da imagem detectada: ${legendaImagem.substring(0, 50)}...`);
                }
                
                const remetente = message.author || message.from;
                const resultadoIA = await ia.processarMensagemBot(media.data, remetente, 'imagem', configGrupo, legendaImagem);
                
                // === VERIFICAÇÃO ESPECIAL: SE A IA DETECTOU MÚLTIPLOS NÚMEROS ===
                if (resultadoIA.tipo === 'multiplos_numeros_nao_permitido') {
                    console.log('🔄 IA detectou múltiplos números em imagem, redirecionando para bot de divisão...');
                    
                    // SE HAZ COMPROVATIVO DA IMAGEM, MEMORIZAR NO BOT DE DIVISÃO
                    if (resultadoIA.comprovativo) {
                        console.log(`💰 Memorizando comprovativo da imagem: ${resultadoIA.comprovativo.referencia} - ${resultadoIA.comprovativo.valor}MT`);
                        
                        // Memorizar comprovativo no bot de divisão
                        const remetenteNormalizado = botDivisao.normalizarRemetente(remetente);
                        botDivisao.comprovantesMemorizados[remetenteNormalizado] = {
                            referencia: resultadoIA.comprovativo.referencia,
                            valor: normalizarValor(resultadoIA.comprovativo.valor),
                            timestamp: Date.now(),
                            grupoId: message.from,
                            fonte: 'imagem_com_multiplos_numeros'
                        };
                        console.log(`✅ Comprovativo memorizado para ${remetenteNormalizado}`);
                    }
                    
                    // Criar mensagem simulada com os números detectados
                    const mensagemNumeros = resultadoIA.numeros.join('\n');
                    const messageSimulada = {
                        body: mensagemNumeros,
                        reply: message.reply.bind(message),
                        author: remetente,
                        from: message.from
                    };
                    
                    const resultadoDivisaoImagem = await botDivisao.processarMensagem(
                        messageSimulada, 
                        remetente, 
                        message.from
                    );
                    
                    if (resultadoDivisaoImagem && resultadoDivisaoImagem.resposta) {
                        await message.reply(resultadoDivisaoImagem.resposta);
                    }
                    
                    return;
                }
                
                if (resultadoIA.sucesso) {
                    
                    if (resultadoIA.tipo === 'comprovante_imagem_recebido') {
                        await message.reply(
                            `✅ *Comprovante da imagem processado!*\n\n` +
                            `💰 Referência: ${resultadoIA.referencia}\n` +
                            `📊 Megas: ${resultadoIA.megas}\n\n` +
                            `📱 *Agora envie UM número que vai receber ${resultadoIA.megas}!*`
                        );
                        return;
                        
                    } else if (resultadoIA.tipo === 'numero_processado') {
                        // NOVA LÓGICA: Verificar se houve subdivisão
                        if (resultadoIA.subdividido && resultadoIA.pedidosSubdivididos) {
                            console.log(`🔧 ATACADO: Processando ${resultadoIA.pedidosSubdivididos.length} pedidos subdivididos...`);
                            
                            // Processar cada pedido subdividido separadamente (SEM VERIFICAÇÃO DE PAGAMENTO)
                            for (let i = 0; i < resultadoIA.pedidosSubdivididos.length; i++) {
                                const pedidoSubdividido = resultadoIA.pedidosSubdivididos[i];
                                const [referenciaSubdiv, megasSubdiv, numeroSubdiv] = pedidoSubdividido.split('|');
                                
                                console.log(`   📦 ATACADO: Processando bloco ${i + 1}/${resultadoIA.pedidosSubdivididos.length}: ${referenciaSubdiv} - ${Math.floor(megasSubdiv/1024)}GB`);
                                
                                const nomeContato = message._data.notifyName || 'N/A';
                                const autorMensagem = message.author || 'Desconhecido';
                                const megasConvertido = converterMegasParaNumero(megasSubdiv);
                                
                                // ENVIAR DIRETO (pagamento original já foi verificado)
                                console.log(`   💰 ATACADO: Bloco subdividido - pulando verificação de pagamento (original já verificado)`);
                                
                                const resultadoEnvio = await enviarParaTasker(referenciaSubdiv, megasConvertido, numeroSubdiv, message.from, message);
                                if (resultadoEnvio === null) {
                                    console.log(`   🛑 ATACADO: Bloco ${referenciaSubdiv} duplicado - continuando`);
                                } else {
                                    console.log(`   ✅ ATACADO: Bloco ${referenciaSubdiv} enviado com sucesso`);
                                }
                                
                                await registrarComprador(message.from, numeroSubdiv, nomeContato, Math.floor(megasConvertido/1024) + 'GB');
                                
                                if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
                                    const timestampMensagem = new Date().toLocaleString('pt-BR');
                                    const configGrupo = CONFIGURACAO_GRUPOS[message.from] || { nome: 'Grupo' };
                                    adicionarNaFila(pedidoSubdividido, autorMensagem, configGrupo.nome, timestampMensagem);
                                }
                            }
                            
                            // Mensagem final sobre subdivisão
                            await message.reply(`✅ *DIVISÃO CONCLUÍDA!*\n\n🔧 **${Math.floor(converterMegasParaNumero(resultadoIA.megas)/1024)}GB subdividido** em **${resultadoIA.pedidosSubdivididos.length} blocos de máx 10GB**\n\n📦 **Blocos criados:**\n${resultadoIA.pedidosSubdivididos.map((p, i) => `• ${p.split('|')[0]}: ${Math.floor(p.split('|')[1]/1024)}GB`).join('\n')}\n\n⚙️ *Sistema processa max 10GB por bloco*\n⏳ *Transferências serão executadas em instantes...*`);
                            return;
                            
                        } else {
                            // LÓGICA ORIGINAL: Pedido único (≤10GB)
                            const dadosCompletos = resultadoIA.dadosCompletos;
                            const [referencia, megas, numero] = dadosCompletos.split('|');
                            const nomeContato = message._data.notifyName || 'N/A';
                            const autorMensagem = message.author || 'Desconhecido';
                            
                            // Converter megas para formato numérico
                            const megasConvertido = converterMegasParaNumero(megas);
                            
                            // Processar como pedido único
                            await processarPedidoIndividual(dadosCompletos, megasConvertido, referencia, numero, nomeContato, autorMensagem, message);
                        }
                } else {
                    await message.reply(
                        `❌ *Não consegui processar o comprovante da imagem!*\n\n` +
                        `📝 Envie o comprovante como texto.`
                    );
                }
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

        // TESTE SIMPLES - Comando de teste
        if (/^!teste$/i.test(message.body)) {
            await message.reply(`✅ Bot funcionando! Grupo: ${configGrupo.nome}`);
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

        // === BOT DE DIVISÃO (ANTES DA IA) ===
        const remetente = message.author || message.from;
        const resultadoDivisao = await botDivisao.processarMensagem(message, remetente, message.from);
        
        if (resultadoDivisao) {
            console.log('🔄 DIVISÃO: Mensagem processada pelo bot de divisão');
            
            // Se o bot de divisão retornou uma resposta, enviar
            if (resultadoDivisao.resposta) {
                await message.reply(resultadoDivisao.resposta);
            }
            
            // Se foi processado com sucesso, não continuar para o bot original
            if (resultadoDivisao.processado) {
                if (resultadoDivisao.duplicados > 0) {
                    console.log(`✅ DIVISÃO: ${resultadoDivisao.sucessos}/${resultadoDivisao.total} pedidos criados, ${resultadoDivisao.duplicados} duplicados`);
                } else {
                    console.log(`✅ DIVISÃO: ${resultadoDivisao.sucessos}/${resultadoDivisao.total} pedidos criados`);
                }
                return; // IMPORTANTE: Sair aqui, não processar no bot original
            }
            
            // Se retornou uma resposta mas não foi processado, também sair
            if (resultadoDivisao.resposta) {
                return;
            }
        }

        // === PROCESSAMENTO COM IA ===
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
                    `📊 Megas: ${resultadoIA.megas}\n\n` +
                    `📱 *Envie UM número que vai receber ${resultadoIA.megas}!*`
                );
                return;
                
            } else if (resultadoIA.tipo === 'numero_processado') {
                const dadosCompletos = resultadoIA.dadosCompletos;
                const [referencia, megas, numero] = dadosCompletos.split('|');
                const nomeContato = message._data.notifyName || 'N/A';
                const autorMensagem = message.author || 'Desconhecido';
                
                // Converter megas para formato numérico
                const megasConvertido = converterMegasParaNumero(megas);
                
                // === NOVA VERIFICAÇÃO: CONFIRMAR PAGAMENTO ANTES DE PROCESSAR ===
                console.log(`🔍 INDIVIDUAL: Verificando pagamento antes de processar texto...`);
                
                // 1. Usar valor do comprovante se disponível, senão calcular
                let valorEsperado;
                if (resultadoIA.valorPago && resultadoIA.valorPago > 0) {
                    // Se a IA extraiu o valor do comprovante, usar esse valor
                    valorEsperado = normalizarValor(resultadoIA.valorPago);
                    console.log(`💰 INDIVIDUAL: Usando valor do comprovante: ${valorEsperado}MT`);
                } else {
                    // Senão, calcular baseado nos megas
                    valorEsperado = calcularValorEsperadoDosMegas(megasConvertido, message.from);
                    console.log(`💰 INDIVIDUAL: Calculando valor baseado nos megas: ${valorEsperado}MT`);
                }
                
                if (!valorEsperado) {
                    console.log(`⚠️ INDIVIDUAL: Não foi possível calcular valor, processando sem verificação`);
                    
                    const resultadoEnvio = await enviarParaTaskerComSubdivisao(referencia, megasConvertido, numero, message.from, message);
                    if (resultadoEnvio === null) {
                        console.log(`🛑 INDIVIDUAL: Processamento parado - duplicado detectado`);
                        return; // Para aqui se for duplicado
                    }
                    await registrarComprador(message.from, numero, nomeContato, resultadoIA.valorPago || megas);
                    
                    if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
                        const timestampMensagem = new Date().toLocaleString('pt-BR');
                        adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
                    }
                    
                    await message.reply(
                        `✅ *Pedido processado!*\n\n` +
                        `💰 Referência: ${referencia}\n` +
                        `📊 Megas: ${megas}\n` +
                        `📱 Número: ${numero}\n\n` +
                        `⏳ *Aguarde uns instantes enquanto o sistema executa a transferência*`
                    );
                    return;
                }
                
                // 2. Verificar se pagamento existe
                const pagamentoConfirmado = await verificarPagamentoIndividual(referencia, valorEsperado);
                
                if (!pagamentoConfirmado) {
                    const valorNormalizado = normalizarValor(valorEsperado);
                    console.log(`❌ INDIVIDUAL: Pagamento não confirmado para texto - ${referencia} (${valorNormalizado}MT)`);
                    
                    await message.reply(
                        `⏳ *AGUARDANDO CONFIRMAÇÃO DO PAGAMENTO*\n\n` +
                        `💰 Referência: ${referencia}\n` +
                        `📊 Megas: ${megas}\n` +
                        `📱 Número: ${numero}\n` +
                        `💳 Valor esperado: ${valorNormalizado}MT\n\n` +
                        `🔍 Aguardando confirmação do pagamento na planilha...\n` +
                        `⏱️ Tente novamente em alguns minutos.`
                    );
                    return;
                }
                
                console.log(`✅ INDIVIDUAL: Pagamento confirmado para texto! Processando...`);
                
                // 3. Se pagamento confirmado, processar normalmente
                const resultadoEnvio = await enviarParaTaskerComSubdivisao(referencia, megasConvertido, numero, message.from, message);
                if (resultadoEnvio === null) {
                    console.log(`🛑 INDIVIDUAL: Processamento parado - duplicado detectado`);
                    return; // Para aqui se for duplicado
                }
                await registrarComprador(message.from, numero, nomeContato, resultadoIA.valorPago || megas);
                
                if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
                    const timestampMensagem = new Date().toLocaleString('pt-BR');
                    adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
                }
                
                await message.reply(
                    `✅ *Pedido processado!*\n\n` +
                    `💰 Referência: ${referencia}\n` +
                    `📊 Megas: ${megas}\n` +
                    `📱 Número: ${numero}\n` +
                    `💳 Pagamento: ${normalizarValor(valorEsperado)}MT confirmado\n\n` +
                    `⏳ *Aguarde uns instantes enquanto o sistema executa a transferência*`
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
            console.log('🔄 IA detectou múltiplos números, redirecionando para bot de divisão...');
            
            const resultadoDivisaoTexto = await botDivisao.processarMensagem(
                message, 
                remetente, 
                message.from
            );
            
            if (resultadoDivisaoTexto && resultadoDivisaoTexto.resposta) {
                await message.reply(resultadoDivisaoTexto.resposta);
            } else {
                // Fallback para a mensagem original se o bot de divisão não processar
                await message.reply(
                    `📱 *${resultadoIA.numeros.length} números detectados*\n\n` +
                    `❌ Sistema atacado aceita apenas UM número por vez.\n\n` +
                    `📝 Envie apenas um número para receber o valor integral.`
                );
            }
            
            return;
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

// Variável para controlar reconexão
let reconnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

client.on('disconnected', async (reason) => {
    console.log('❌ Bot atacado desconectado:', reason);
    
    if (!reconnecting && reconnectAttempts < maxReconnectAttempts) {
        reconnecting = true;
        reconnectAttempts++;
        
        console.log(`🔄 Tentando reconectar... (Tentativa ${reconnectAttempts}/${maxReconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                await client.initialize();
                console.log('✅ Reconectado com sucesso!');
                reconnecting = false;
                reconnectAttempts = 0;
            } catch (error) {
                console.error('❌ Falha na reconexão:', error);
                reconnecting = false;
                
                if (reconnectAttempts >= maxReconnectAttempts) {
                    console.log('❌ Máximo de tentativas de reconexão atingido. Reinicialize manualmente.');
                }
            }
        }, 5000 * reconnectAttempts); // Delay progressivo
    }
});

// Evento para detectar quando a sessão é destruída
client.on('auth_failure', (message) => {
    console.error('❌ Falha na autenticação:', message);
    reconnectAttempts = 0; // Reset para permitir novas tentativas
});

// Capturar erros do Puppeteer
client.on('change_state', (state) => {
    console.log('🔄 Estado do cliente mudou para:', state);
});

// Adicionar tratamento para erros de protocolo
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
    
    // Se for erro de contexto destruído, tentar reconectar
    if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
        console.log('🔄 Erro de contexto detectado, forçando reconexão...');
        if (!reconnecting) {
            client.emit('disconnected', 'Execution context destroyed');
        }
    }
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
    console.log('📦 Sistema atacado: CÁLCULO AUTOMÁTICO DE MEGAS');
    console.log('📊 Google Sheets ATACADO: CONFIGURADO');
    console.log(`🔗 URL: ${GOOGLE_SHEETS_CONFIG_ATACADO.scriptUrl}`);
    console.log(ia.getStatus());
    process.exit(0);

});

// === NOVA FUNÇÃO: ENVIAR COM SUBDIVISÃO AUTOMÁTICA ===
async function enviarParaTaskerComSubdivisao(referencia, megasConvertido, numero, grupoId, message) {
    console.log(`🔧 WRAPPER: Verificando se ${Math.floor(megasConvertido/1024)}GB precisa subdivisão antes de enviar...`);
    
    // Se for 10GB ou menos, enviar normalmente
    if (megasConvertido <= 10240) {
        console.log(`   ✅ WRAPPER: ${Math.floor(megasConvertido/1024)}GB ≤ 10GB - Enviando direto`);
        return await enviarParaTasker(referencia, megasConvertido, numero, grupoId, message);
    }
    
    // Precisa subdividir
    console.log(`   🔧 WRAPPER: ${Math.floor(megasConvertido/1024)}GB > 10GB - Aplicando subdivisão...`);
    
    const numeroBlocos = Math.ceil(megasConvertido / 10240);
    const megasPorBloco = Math.floor(megasConvertido / numeroBlocos);
    const megasRestante = megasConvertido % numeroBlocos;
    
    console.log(`   📦 WRAPPER: ${Math.floor(megasConvertido/1024)}GB → ${numeroBlocos} blocos de ~${Math.floor(megasPorBloco/1024)}GB`);
    
    let todosSucesso = 0;
    let totalDuplicados = 0;
    
    // Criar e enviar cada bloco
    for (let i = 0; i < numeroBlocos; i++) {
        let megasBloco = megasPorBloco;
        
        // Distribuir resto nos primeiros blocos
        if (i < megasRestante) {
            megasBloco += 1;
        }
        
        // Garantir que nenhum bloco exceda 10GB
        if (megasBloco > 10240) {
            megasBloco = 10240;
        }
        
        const referenciaSubdiv = referencia + String(i + 1);
        
        console.log(`      📋 WRAPPER: Enviando bloco ${i + 1}/${numeroBlocos}: ${referenciaSubdiv} - ${Math.floor(megasBloco/1024)}GB (${megasBloco}MB)`);
        
        try {
            const resultadoBloco = await enviarParaTasker(referenciaSubdiv, megasBloco, numero, grupoId, message);
            
            if (resultadoBloco === null) {
                console.log(`      ⚠️ WRAPPER: Bloco ${referenciaSubdiv} duplicado - continuando com próximos`);
                totalDuplicados++;
            } else {
                console.log(`      ✅ WRAPPER: Bloco ${referenciaSubdiv} enviado com sucesso`);
                todosSucesso++;
            }
            
        } catch (error) {
            console.error(`      ❌ WRAPPER: Erro ao enviar bloco ${referenciaSubdiv}:`, error);
        }
    }
    
    // Validar resultado
    const totalProcessados = todosSucesso + totalDuplicados;
    
    if (totalProcessados === 0) {
        console.log(`❌ WRAPPER: Nenhum bloco foi processado com sucesso`);
        return null; // Indicar falha total
    }
    
    if (todosSucesso === 0) {
        console.log(`⚠️ WRAPPER: Todos os ${numeroBlocos} blocos eram duplicados`);
        return null; // Todos duplicados
    }
    
    console.log(`✅ WRAPPER: Subdivisão concluída! ${todosSucesso} novos + ${totalDuplicados} duplicados = ${totalProcessados}/${numeroBlocos} blocos`);
    
    // Retornar resultado de sucesso com informações da subdivisão
    return { 
        sucesso: true, 
        subdividido: true,
        blocosNovos: todosSucesso,
        blocosDuplicados: totalDuplicados,
        totalBlocos: numeroBlocos
    };
}

// === NOVA FUNÇÃO: PROCESSAR PEDIDO INDIVIDUAL (EVITA DUPLICAÇÃO) ===
async function processarPedidoIndividual(dadosCompletos, megasConvertido, referencia, numero, nomeContato, autorMensagem, message) {
    console.log(`📝 INDIVIDUAL: Processando pedido individual: ${referencia} - ${Math.floor(megasConvertido/1024)}GB para ${numero}`);
    
    // 1. Calcular valor esperado baseado nos megas
    const valorEsperado = calcularValorEsperadoDosMegas(megasConvertido, message.from);
    
    if (!valorEsperado) {
        console.log(`⚠️ INDIVIDUAL: Não foi possível calcular valor, processando sem verificação`);
        
        const resultadoEnvio = await enviarParaTaskerComSubdivisao(referencia, megasConvertido, numero, message.from, message);
        if (resultadoEnvio === null) {
            console.log(`🛑 INDIVIDUAL: Processamento parado - duplicado detectado para ${referencia}`);
            return; // Para aqui se for duplicado
        }
        await registrarComprador(message.from, numero, nomeContato, Math.floor(megasConvertido/1024) + 'GB');
        
        if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
            const timestampMensagem = new Date().toLocaleString('pt-BR');
            const configGrupo = CONFIGURACAO_GRUPOS[message.from] || { nome: 'Grupo' };
            adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
        }
        
        console.log(`✅ INDIVIDUAL: ${referencia} processado sem verificação de pagamento`);
        return;
    }
    
    // 2. Verificar se pagamento existe
    const pagamentoConfirmado = await verificarPagamentoIndividual(referencia, valorEsperado);
    
    if (!pagamentoConfirmado) {
        const valorNormalizado = normalizarValor(valorEsperado);
        console.log(`❌ INDIVIDUAL: Pagamento não confirmado para ${referencia} (${valorNormalizado}MT)`);
        return; // Não processar se pagamento não confirmado
    }
    
    console.log(`✅ INDIVIDUAL: Pagamento confirmado para ${referencia}! Processando...`);
    
    // 3. Se pagamento confirmado, processar normalmente
    const resultadoEnvio = await enviarParaTaskerComSubdivisao(referencia, megasConvertido, numero, message.from, message);
    if (resultadoEnvio === null) {
        console.log(`🛑 INDIVIDUAL: Processamento parado - duplicado detectado para ${referencia}`);
        return; // Para aqui se for duplicado
    }
    
    await registrarComprador(message.from, numero, nomeContato, Math.floor(megasConvertido/1024) + 'GB');
    
    if (message.from === ENCAMINHAMENTO_CONFIG.grupoOrigem) {
        const timestampMensagem = new Date().toLocaleString('pt-BR');
        const configGrupo = CONFIGURACAO_GRUPOS[message.from] || { nome: 'Grupo' };
        adicionarNaFila(dadosCompletos, autorMensagem, configGrupo.nome, timestampMensagem);
    }
    
    console.log(`✅ INDIVIDUAL: ${referencia} processado com sucesso - ${Math.floor(megasConvertido/1024)}GB para ${numero}`);
}


