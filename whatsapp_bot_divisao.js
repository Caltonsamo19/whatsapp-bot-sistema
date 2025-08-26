const axios = require('axios');
const WhatsAppAIAtacado = require('./whatsapp_ai_atacado');

class WhatsAppBotDivisao {
    constructor() {
        this.comprovantesMemorizados = {};
        this.processandoDivisoes = new Set();
        
        // Inicializar IA usando variável de ambiente (mesma do servidor)
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (openaiApiKey) {
            this.ia = new WhatsAppAIAtacado(openaiApiKey);
            console.log('🧠 IA integrada ao bot de divisão usando .env!');
        } else {
            this.ia = null;
            console.log('⚠️ IA não disponível - OPENAI_API_KEY não encontrada no .env');
        }
        
        // URLs dos Google Apps Scripts existentes
        this.SCRIPTS_CONFIG = {
            PEDIDOS: 'https://script.google.com/macros/s/AKfycbzdvM-IrH4a6gS53WZ0J-AGXY0duHfgv15DyxdqUm1BLEm3Z15T67qgstu6yPTedgOSCA/exec',
            PAGAMENTOS: 'https://script.google.com/macros/s/AKfycbzzifHGu1JXc2etzG3vqK5Jd3ihtULKezUTQQIDJNsr6tXx3CmVmKkOlsld0x1Feo0H/exec'
        };
        
        // Configuração dos grupos (mesma estrutura do sistema atual)
        this.CONFIGURACAO_GRUPOS = {
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
                },
                // NÚMEROS DE PAGAMENTO DO GRUPO (NUNCA devem receber megas)
                numerosPagamento: [
                    '870059057',   // Número eMola do grupo
                    '840326152',   // Número M-Pesa do VASCO
                    '884032615',   // Versão truncada que aparece nos logs
                    '258840326152', // Versão completa com prefixo
                    '877777777'    // Adicionar outros números de pagamento do grupo aqui
                ]
            }
            // Adicionar outros grupos conforme necessário
        };
        
        // Limpar comprovativos antigos a cada 10 minutos
        setInterval(() => {
            this.limparComprovantesAntigos();
        }, 10 * 60 * 1000);
        
        console.log('🔄 Bot de Divisão inicializado - Múltiplos números automático!');
    }
    
    // === FUNÇÃO PRINCIPAL - PROCESSAR MENSAGEM ===
    async processarMensagem(message, remetente, grupoId) {
        try {
            let mensagem = message.body ? message.body.trim() : '';
            
            // Só processa grupos configurados
            if (!this.CONFIGURACAO_GRUPOS[grupoId]) {
                return null;
            }
            
            console.log(`\n🔍 DIVISÃO: Analisando mensagem de ${remetente}`);
            
            // VERIFICAR SE TEM IMAGEM COM COMPROVATIVO
            if (message.hasMedia && (message.type === 'image' || message.type === 'document')) {
                console.log(`📷 DIVISÃO: Mensagem contém mídia do tipo: ${message.type}`);
                try {
                    const resultadoImagem = await this.extrairTextoDeImagem(message, grupoId);
                    
                    // Se a IA já processou tudo completamente, retornar resultado direto
                    if (resultadoImagem && resultadoImagem.processadoCompleto) {
                        console.log('🎯 DIVISÃO: IA processou imagem + número completamente!');
                        return resultadoImagem.resultado;
                    }
                    
                    // Se extraiu texto do comprovativo, continuar processamento normal
                    if (resultadoImagem && typeof resultadoImagem === 'string') {
                        console.log(`📄 DIVISÃO: Texto extraído da imagem: "${resultadoImagem.substring(0, 100)}..."`);
                        mensagem = resultadoImagem + ' ' + mensagem; // Combinar texto da imagem com texto da mensagem
                    } else {
                        // Se tem imagem mas não conseguiu extrair texto, orientar o usuário
                        console.log('💡 DIVISÃO: Imagem detectada mas texto não extraído');
                        return {
                            resposta: `📷 *COMPROVATIVO EM IMAGEM DETECTADO*\n\n🧠 Tentei processar com IA avançada mas não consegui extrair os dados.\n\n💡 *Para melhor resultado:*\n• Tire uma foto mais clara e focada\n• Certifique-se que TODO o comprovativo está visível\n• Ou copie e cole o texto do comprovativo\n\n🔍 Exemplo: Confirmado ABC123 - Transferiste 250MT`
                        };
                    }
                } catch (error) {
                    console.error('❌ DIVISÃO: Erro ao extrair texto da imagem:', error);
                }
            }
            
            // 1. DETECTAR SE É COMPROVATIVO SEM NÚMEROS
            const comprovativo = this.extrairComprovativo(mensagem);
            if (comprovativo && !this.temNumeros(mensagem)) {
                console.log(`💰 DIVISÃO: Comprovativo memorizado: ${comprovativo.referencia} - ${comprovativo.valor}MT`);
                this.comprovantesMemorizados[remetente] = {
                    ...comprovativo,
                    timestamp: Date.now(),
                    grupoId: grupoId
                };
                return null; // Não responde ainda
            }
            
            // 2. DETECTAR MÚLTIPLOS NÚMEROS (para verificar se precisa processar)
            const numerosDetectados = this.extrairMultiplosNumeros(mensagem, grupoId);
            
            // 3. PRIORIDADE: COMPROVATIVO + MÚLTIPLOS NÚMEROS NA MESMA MENSAGEM
            if (comprovativo && numerosDetectados && numerosDetectados.length > 1) {
                console.log(`🎯 DIVISÃO: Comprovativo + múltiplos números na mesma mensagem!`);
                console.log(`📱 DIVISÃO: ${numerosDetectados.length} números detectados: ${numerosDetectados.join(', ')}`);
                return await this.processarDivisao(comprovativo, numerosDetectados, grupoId, message);
            }
            
            // 4. CASO ALTERNATIVO: APENAS MÚLTIPLOS NÚMEROS (buscar comprovativo memorizado)
            if (numerosDetectados && numerosDetectados.length > 1 && !comprovativo) {
                console.log(`📱 DIVISÃO: ${numerosDetectados.length} números detectados sem comprovativo na mensagem`);
                
                // Procurar comprovativo memorizado
                let comprovantivoAssociado = this.comprovantesMemorizados[remetente];
                
                // Se não tem memorizado, buscar no histórico (últimos 30 min)
                if (!comprovantivoAssociado) {
                    comprovantivoAssociado = await this.buscarComprovanteRecenteHist(remetente);
                }
                
                if (comprovantivoAssociado) {
                    console.log(`✅ DIVISÃO: Comprovativo memorizado encontrado para divisão!`);
                    return await this.processarDivisao(comprovantivoAssociado, numerosDetectados, grupoId, message);
                } else {
                    console.log(`❌ DIVISÃO: Nenhum comprovativo encontrado para ${remetente}`);
                    return {
                        resposta: `📱 *${numerosDetectados.length} números detectados*\n\n❌ Não encontrei seu comprovativo nos últimos 30 minutos.\n\n🔍 Envie primeiro o comprovativo de pagamento.`
                    };
                }
            }
            
            return null; // Não é caso para divisão
            
        } catch (error) {
            console.error('❌ DIVISÃO: Erro ao processar mensagem:', error);
            return {
                resposta: '❌ Erro interno no sistema de divisão. Tente novamente.'
            };
        }
    }
    
    // === EXTRAIR COMPROVATIVO ===
    extrairComprovativo(mensagem) {
        const mensagemLimpa = mensagem.trim();
        console.log(`🔍 DIVISÃO: Verificando comprovativo em: "${mensagemLimpa.substring(0, 50)}..."`);
        
        const temConfirmado = /^confirmado/i.test(mensagemLimpa);
        const temID = /^id\s/i.test(mensagemLimpa);
        const temEmola = /e-?mola|emola/i.test(mensagemLimpa);
        const temTransferencia = /transferencia\s+realizada/i.test(mensagemLimpa);
        const temRecibo = /recibo\s+de\s+transferencia/i.test(mensagemLimpa);
        
        console.log(`🔍 DIVISÃO: temConfirmado: ${temConfirmado}, temID: ${temID}, temEmola: ${temEmola}, temTransferencia: ${temTransferencia}, temRecibo: ${temRecibo}`);
        
        if (!temConfirmado && !temID && !temEmola && !temTransferencia && !temRecibo) {
            console.log(`❌ DIVISÃO: Não é comprovativo reconhecido`);
            return null;
        }
        
        // Patterns para extrair referência e valor (M-Pesa e eMola)
        const patternsRef = [
            // M-Pesa
            /Confirmado\s+([A-Z0-9]+)/i,
            // eMola - Padrões com pontos (incluindo ponto final)
            /ID da transacao\s+([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?\s/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+)\.?/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+)\.?/i,
            /Referencia\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?/i,
            /Referencia\s*:?\s*([A-Z0-9]+)\.?/i,
            /Codigo\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?/i,
            /Codigo\s*:?\s*([A-Z0-9]+)\.?/i,
            /ID\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?/i,
            /Numero da transacao\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)\.?/i
        ];
        
        const patternsValor = [
            // M-Pesa
            /Transferiste\s+(\d+(?:[.,]\d+)?)MT/i,
            // eMola
            /Valor\s*:?\s*(\d+(?:[.,]\d+)?)MT/i,
            /Montante\s*:?\s*(\d+(?:[.,]\d+)?)MT/i,
            /Total\s*:?\s*(\d+(?:[.,]\d+)?)MT/i,
            // Genérico
            /(\d+(?:[.,]\d+)?)\s*MT/i
        ];
        
        let referencia = null;
        let valor = null;
        
        // Extrair referência
        for (const pattern of patternsRef) {
            const match = mensagem.match(pattern);
            if (match) {
                referencia = match[1];
                break;
            }
        }
        
        // Extrair valor
        for (const pattern of patternsValor) {
            const match = mensagem.match(pattern);
            if (match) {
                valor = parseFloat(match[1].replace(',', '.'));
                // Se for número inteiro, remover decimais
                if (valor % 1 === 0) valor = parseInt(valor);
                break;
            }
        }
        
        console.log(`🔍 DIVISÃO: Referência extraída: "${referencia}", Valor: ${valor}`);
        
        if (referencia && valor) {
            console.log(`✅ DIVISÃO: Comprovativo extraído com sucesso!`);
            return { referencia, valor };
        }
        
        console.log(`❌ DIVISÃO: Falha na extração - Referência: ${referencia}, Valor: ${valor}`);
        return null;
    }
    
    // === VERIFICAR SE TEM NÚMEROS ===
    temNumeros(mensagem) {
        const regex = /(?:\+258\s*)?8[0-9]{8}/g;
        const matches = mensagem.match(regex);
        return matches && matches.length > 0;
    }
    
    // === EXTRAIR MÚLTIPLOS NÚMEROS ===
    extrairMultiplosNumeros(mensagem, grupoId = null) {
        const regex = /(?:\+258\s*)?8[0-9]{8}/g;
        const matches = mensagem.match(regex) || [];
        
        if (matches.length === 0) return null;
        
        // Limpar e filtrar números válidos
        const numerosLimpos = matches.map(num => this.limparNumero(num))
                                    .filter(num => num && /^8[0-9]{8}$/.test(num));
        
        // Remover duplicatas
        const numerosUnicos = [...new Set(numerosLimpos)];
        
        // === FILTRAR NÚMEROS QUE NÃO SÃO PARA DIVISÃO ===
        const numerosFiltrados = this.filtrarNumerosComprovante(numerosUnicos, mensagem, grupoId);
        
        return numerosFiltrados.length > 0 ? numerosFiltrados : null;
    }
    
    // === FILTRAR NÚMEROS DE COMPROVANTE ===
    filtrarNumerosComprovante(numeros, mensagem, grupoId = null) {
        return numeros.filter(numero => {
            console.log(`🔍 DIVISÃO: Analisando ${numero}...`);
            
            // 1. VERIFICAR SE É NÚMERO DE PAGAMENTO DO GRUPO
            if (grupoId && this.CONFIGURACAO_GRUPOS[grupoId] && this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento) {
                const numerosPagamento = this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento;
                if (numerosPagamento.includes(numero)) {
                    console.log(`🚫 DIVISÃO: ${numero} REJEITADO (é número de pagamento do grupo)`);
                    return false;
                }
            }
            
            // 2. VERIFICAR POSIÇÃO NA MENSAGEM
            const posicaoNumero = mensagem.indexOf(numero);
            const comprimentoMensagem = mensagem.length;
            const percentualPosicao = (posicaoNumero / comprimentoMensagem) * 100;
            
            console.log(`🔍 DIVISÃO: ${numero} - posição ${percentualPosicao.toFixed(1)}% da mensagem`);
            
            // Se o número está no início da mensagem (<30%), é provavelmente número de pagamento
            if (percentualPosicao < 30) {
                console.log(`🚫 DIVISÃO: ${numero} REJEITADO (está no início da mensagem - possível número de pagamento)`);
                return false;
            }
            
            // Se o número está no final da mensagem (>70%), é provavelmente para divisão
            if (percentualPosicao > 70) {
                console.log(`✅ DIVISÃO: ${numero} ACEITO (está no final da mensagem)`);
                return true;
            }
            
            // 3. VERIFICAR CONTEXTOS ESPECÍFICOS DE PAGAMENTO
            const contextosPagamentoEspecificos = [
                new RegExp(`para\\s+conta\\s+${numero}`, 'i'),                    // "para conta 870059057"
                new RegExp(`conta\\s+${numero}`, 'i'),                            // "conta 870059057"
                new RegExp(`para\\s+${numero}\\s*,\\s*nome`, 'i'),               // "para 870059057, nome:"
                new RegExp(`Transferiste.*para\\s+${numero}\\s*-`, 'i'),         // "Transferiste ... para 840326152 - VASCO"
                new RegExp(`${numero}\\s*,\\s*nome:`, 'i'),                      // "870059057, nome: vasco"
                new RegExp(`para\\s+${numero}\\s*-\\s*[A-Z]`, 'i'),              // "para 840326152 - VASCO"
                new RegExp(`para\\s+258${numero}\\s*-`, 'i'),                    // "para 258840326152 - VASCO"
                new RegExp(`MT.*para\\s+${numero}`, 'i'),                        // "750.00MT ... para 840326152"
                new RegExp(`taxa.*para\\s+${numero}`, 'i'),                      // "taxa foi ... para 840326152"
                new RegExp(`${numero}\\s*-\\s*[A-Z]{2,}`, 'i'),                  // "840326152 - VASCO"
                new RegExp(`258${numero}\\s*-\\s*[A-Z]{2,}`, 'i'),               // "258840326152 - VASCO"
            ];
            
            // Se o número aparece em contexto ESPECÍFICO de pagamento, não é para divisão
            for (const padrao of contextosPagamentoEspecificos) {
                if (padrao.test(mensagem)) {
                    console.log(`🚫 DIVISÃO: ${numero} REJEITADO (contexto específico de pagamento)`);
                    return false;
                }
            }
            
            console.log(`✅ DIVISÃO: ${numero} ACEITO (não está em contexto de pagamento)`);
            return true; // Número válido para divisão
        });
    }
    
    // === LIMPAR NÚMERO ===
    limparNumero(numero) {
        if (!numero || typeof numero !== 'string') return numero;
        
        return numero
            .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '') // Caracteres invisíveis
            .replace(/^\+258\s*/, '') // Remove +258
            .replace(/\s+/g, '') // Remove espaços
            .trim();
    }
    
    // === BUSCAR COMPROVATIVO NO HISTÓRICO (SIMULADO) ===
    async buscarComprovanteRecenteHist(remetente) {
        // Esta função pode ser expandida para integrar com histórico real
        // Por agora, verifica apenas os memorizados
        const comprovativo = this.comprovantesMemorizados[remetente];
        if (comprovativo && (Date.now() - comprovativo.timestamp) <= 1800000) { // 30 min
            return comprovativo;
        }
        return null;
    }
    
    // === PROCESSAR DIVISÃO ===
    async processarDivisao(comprovativo, numeros, grupoId, message) {
        const chaveProcessamento = `${comprovativo.referencia}_${numeros.join('_')}`;
        
        // Evitar processamento duplicado
        if (this.processandoDivisoes.has(chaveProcessamento)) {
            return { resposta: '⏳ Divisão já em processamento...' };
        }
        
        this.processandoDivisoes.add(chaveProcessamento);
        
        try {
            console.log(`🔄 DIVISÃO: Iniciando processamento de ${comprovativo.referencia}`);
            
            // 1. CONFIRMAR PAGAMENTO EXISTE
            const pagamentoExiste = await this.buscarPagamentoNaPlanilha(
                comprovativo.referencia, 
                comprovativo.valor
            );
            
            if (!pagamentoExiste) {
                console.log(`⏳ DIVISÃO: Pagamento não encontrado, aguardando...`);
                return {
                    resposta: `⏳ *PAGAMENTO NÃO ENCONTRADO*\n\n💰 Referência: ${comprovativo.referencia}\n💳 Valor: ${comprovativo.valor}MT\n\n🔍 Aguardando confirmação do pagamento...`
                };
            }
            
            console.log(`✅ DIVISÃO: Pagamento confirmado!`);
            
            // 2. CALCULAR DIVISÃO
            const divisao = this.calcularDivisaoPorPrioridade(comprovativo.valor, numeros, grupoId);
            
            if (!divisao || divisao.length === 0) {
                return {
                    resposta: `❌ *ERRO NO CÁLCULO*\n\n💰 Valor ${comprovativo.valor}MT não pode ser dividido pelos números informados.\n\n📋 Verifique a tabela de preços do grupo.`
                };
            }
            
            // 3. GERAR NOVAS REFERÊNCIAS
            const novasReferencias = [];
            for (let i = 0; i < divisao.length; i++) {
                novasReferencias.push(comprovativo.referencia + String(i + 1).padStart(3, '0'));
            }
            
            // 4. ENVIAR MENSAGEM INFORMATIVA
            let mensagemResposta = `🔄 *MÚLTIPLOS NÚMEROS DETECTADOS!*\n\n`;
            mensagemResposta += `💰 **${comprovativo.referencia}** - ${comprovativo.valor}MT\n`;
            mensagemResposta += `📱 **${numeros.length} números** serão processados\n\n`;
            mensagemResposta += `⚡ **Divisão automática:**\n`;
            
            divisao.forEach((item, i) => {
                mensagemResposta += `   • ${item.numero}: ${item.megasTexto} (${item.valorMT}MT)\n`;
            });
            
            mensagemResposta += `\n⏳ *Criando pedidos separados...*`;
            
            // Enviar mensagem
            await message.reply(mensagemResposta);
            
            // 5. CRIAR REGISTROS DIVIDIDOS
            let sucessos = 0;
            for (let i = 0; i < divisao.length; i++) {
                const { numero, megas, valorMT } = divisao[i];
                const novaRef = novasReferencias[i];
                
                try {
                    // PEDIDO na planilha de pedidos
                    await this.enviarParaPlanilhaPedidos(novaRef, megas, numero, grupoId);
                    
                    // PAGAMENTO na planilha de pagamentos  
                    await this.enviarParaPlanilhaPagamentos(novaRef, valorMT, numero, grupoId);
                    
                    sucessos++;
                    console.log(`✅ DIVISÃO: ${novaRef} criado com sucesso`);
                    
                } catch (error) {
                    console.error(`❌ DIVISÃO: Erro ao criar ${novaRef}:`, error);
                }
            }
            
            // 6. LIMPAR DADOS E RESPONDER
            delete this.comprovantesMemorizados[message.author || message.from];
            
            const mensagemFinal = `✅ *DIVISÃO CONCLUÍDA!*\n\n` +
                `🎯 **${sucessos}/${divisao.length} pedidos criados**\n` +
                `📊 Referências: ${novasReferencias.join(', ')}\n\n` +
                `⏳ *O sistema principal processará as transferências em instantes...*`;
            
            // Aguardar um pouco antes da mensagem final
            setTimeout(async () => {
                try {
                    await message.reply(mensagemFinal);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem final:', error);
                }
            }, 2000);
            
            return { processado: true, sucessos, total: divisao.length };
            
        } catch (error) {
            console.error('❌ DIVISÃO: Erro no processamento:', error);
            return {
                resposta: `❌ *ERRO NO PROCESSAMENTO*\n\n${error.message}`
            };
        } finally {
            this.processandoDivisoes.delete(chaveProcessamento);
        }
    }
    
    // === BUSCAR PAGAMENTO NA PLANILHA ===
    async buscarPagamentoNaPlanilha(referencia, valorEsperado) {
        try {
            console.log(`🔍 DIVISÃO: Buscando pagamento ${referencia} - ${valorEsperado}MT`);
            
            const response = await axios.post(this.SCRIPTS_CONFIG.PAGAMENTOS, {
                action: "buscar_por_referencia",
                referencia: referencia,
                valor: valorEsperado
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`🔍 DIVISÃO: Resposta da busca:`, JSON.stringify(response.data));
            
            if (response.data && response.data.encontrado) {
                console.log(`✅ DIVISÃO: Pagamento encontrado!`);
                return true;
            }
            
            console.log(`❌ DIVISÃO: Pagamento não encontrado`);
            return false;
            
        } catch (error) {
            console.error(`❌ DIVISÃO: Erro ao buscar pagamento:`, error.message);
            return false;
        }
    }
    
    // === CALCULAR DIVISÃO POR PRIORIDADE ===
    calcularDivisaoPorPrioridade(valorTotal, numeros, grupoId) {
        try {
            const configGrupo = this.CONFIGURACAO_GRUPOS[grupoId];
            if (!configGrupo || !configGrupo.precos) {
                console.error(`❌ DIVISÃO: Grupo ${grupoId} não configurado`);
                return null;
            }
            
            // Converter valor para megas total
            let megasTotal = null;
            for (const [megas, preco] of Object.entries(configGrupo.precos)) {
                if (preco === valorTotal) {
                    megasTotal = parseInt(megas);
                    break;
                }
            }
            
            if (!megasTotal) {
                console.error(`❌ DIVISÃO: Valor ${valorTotal}MT não encontrado na tabela`);
                return null;
            }
            
            console.log(`📊 DIVISÃO: ${valorTotal}MT = ${megasTotal}MB total para ${numeros.length} números`);
            
            // Calcular divisão base
            const megasPorNumero = Math.floor(megasTotal / numeros.length);
            const megasBase = Math.floor(megasPorNumero / 10240) * 10240; // Arredondar para múltiplo de 10GB
            const megasRestante = megasTotal - (megasBase * numeros.length);
            
            console.log(`📊 DIVISÃO: Base ${megasBase}MB cada, restante ${megasRestante}MB`);
            
            // Distribuir por prioridade
            const resultado = [];
            for (let i = 0; i < numeros.length; i++) {
                let megasFinais = megasBase;
                
                // Distribuir restante por prioridade (primeiros números recebem mais)
                if (megasRestante > 0 && i < Math.floor(megasRestante / 10240)) {
                    megasFinais += 10240; // +10GB
                }
                
                // Encontrar valor em MT correspondente
                let valorMT = null;
                let megasTexto = '';
                
                for (const [megas, preco] of Object.entries(configGrupo.precos)) {
                    if (parseInt(megas) === megasFinais) {
                        valorMT = preco;
                        megasTexto = `${megasFinais / 1024}GB`;
                        break;
                    }
                }
                
                if (valorMT === null) {
                    console.error(`❌ DIVISÃO: Não encontrou preço para ${megasFinais}MB`);
                    return null;
                }
                
                resultado.push({
                    numero: numeros[i],
                    megas: megasFinais,
                    megasTexto: megasTexto,
                    valorMT: valorMT
                });
            }
            
            // Verificar se a divisão está correta
            const somaValores = resultado.reduce((sum, item) => sum + item.valorMT, 0);
            if (somaValores !== valorTotal) {
                console.error(`❌ DIVISÃO: Soma ${somaValores}MT ≠ Total ${valorTotal}MT`);
                return null;
            }
            
            console.log(`✅ DIVISÃO: Cálculo concluído - ${resultado.length} divisões`);
            return resultado;
            
        } catch (error) {
            console.error(`❌ DIVISÃO: Erro no cálculo:`, error);
            return null;
        }
    }
    
    // === ENVIAR PARA PLANILHA DE PEDIDOS ===
    async enviarParaPlanilhaPedidos(referencia, megas, numero, grupoId) {
        try {
            console.log(`📋 DIVISÃO: Enviando pedido ${referencia}|${megas}|${numero}`);
            
            const timestamp = new Date().toLocaleString('pt-BR');
            const dadosCompletos = `${referencia}|${megas}|${numero}|${timestamp}`;
            
            const dados = {
                grupo_id: grupoId,
                timestamp: timestamp,
                dados: dadosCompletos,
                sender: "WhatsApp-Bot-Divisao",
                message: `Pedido dividido: ${dadosCompletos}`
            };
            
            console.log(`📋 DIVISÃO: URL PEDIDOS: ${this.SCRIPTS_CONFIG.PEDIDOS}`);
            console.log(`📋 DIVISÃO: Dados:`, JSON.stringify(dados));
            
            const response = await axios.post(this.SCRIPTS_CONFIG.PEDIDOS, dados, {
                timeout: 20000, // Aumentado para 20 segundos
                headers: { 'Content-Type': 'application/json' },
                retry: 2 // Tentar novamente se falhar
            });
            
            console.log(`📋 DIVISÃO: Resposta recebida:`, response.data);
            
            if (!response.data || !response.data.success) {
                const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                throw new Error(`Erro ao salvar pedido: ${responseText}`);
            }
            
            console.log(`✅ DIVISÃO: Pedido salvo com sucesso - ${referencia}|${megas}|${numero}`);
            
        } catch (error) {
            console.error(`❌ DIVISÃO: Erro ao enviar pedido:`, error.message);
            
            // Se foi timeout, tentar novamente
            if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
                console.log(`🔄 DIVISÃO: Tentando reenviar pedido após timeout...`);
                try {
                    const response = await axios.post(this.SCRIPTS_CONFIG.PEDIDOS, dados, {
                        timeout: 30000, // 30 segundos na segunda tentativa
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    console.log(`✅ DIVISÃO: Pedido enviado na segunda tentativa:`, response.data);
                    
                    if (response.data && response.data.success) {
                        console.log(`✅ DIVISÃO: Pedido salvo com sucesso na segunda tentativa - ${referencia}|${megas}|${numero}`);
                        return;
                    }
                } catch (retryError) {
                    console.error(`❌ DIVISÃO: Segunda tentativa também falhou:`, retryError.message);
                }
            }
            
            throw error;
        }
    }
    
    // === ENVIAR PARA PLANILHA DE PAGAMENTOS ===
    async enviarParaPlanilhaPagamentos(referencia, valor, numero, grupoId) {
        try {
            console.log(`💰 DIVISÃO: Enviando pagamento ${referencia}|${valor}|${numero}`);
            
            const timestamp = new Date().toLocaleString('pt-BR');
            const dadosCompletos = `${referencia}|${valor}|${numero}|${timestamp}`;
            
            const dados = {
                grupo_id: grupoId,
                timestamp: timestamp,
                transacao: dadosCompletos,
                sender: "WhatsApp-Bot-Divisao",
                message: `Pagamento dividido: ${dadosCompletos}`
            };
            
            console.log(`💰 DIVISÃO: URL PAGAMENTOS: ${this.SCRIPTS_CONFIG.PAGAMENTOS}`);
            console.log(`💰 DIVISÃO: Dados:`, JSON.stringify(dados));
            
            const response = await axios.post(this.SCRIPTS_CONFIG.PAGAMENTOS, dados, {
                timeout: 20000, // Aumentado para 20 segundos  
                headers: { 'Content-Type': 'application/json' },
                retry: 2 // Tentar novamente se falhar
            });
            
            console.log(`💰 DIVISÃO: Resposta recebida:`, response.data);
            
            // Verificar se foi sucesso - pode ser objeto {success: true} ou string "Sucesso!"
            const isSuccess = (response.data && response.data.success) || 
                             (typeof response.data === 'string' && response.data.includes('Sucesso'));
            
            if (!response.data || !isSuccess) {
                const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                throw new Error(`Erro ao salvar pagamento: ${responseText}`);
            }
            
            console.log(`✅ DIVISÃO: Pagamento salvo com sucesso - ${referencia}|${valor}|${numero}`);
            
        } catch (error) {
            console.error(`❌ DIVISÃO: Erro ao enviar pagamento:`, error.message);
            
            // Se foi timeout, tentar novamente
            if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
                console.log(`🔄 DIVISÃO: Tentando reenviar pagamento após timeout...`);
                try {
                    const response = await axios.post(this.SCRIPTS_CONFIG.PAGAMENTOS, dados, {
                        timeout: 30000, // 30 segundos na segunda tentativa
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    console.log(`✅ DIVISÃO: Pagamento enviado na segunda tentativa:`, response.data);
                    
                    const isSuccess = (response.data && response.data.success) || 
                                     (typeof response.data === 'string' && response.data.includes('Sucesso'));
                    
                    if (isSuccess) {
                        console.log(`✅ DIVISÃO: Pagamento salvo com sucesso na segunda tentativa - ${referencia}|${valor}|${numero}`);
                        return;
                    }
                } catch (retryError) {
                    console.error(`❌ DIVISÃO: Segunda tentativa de pagamento também falhou:`, retryError.message);
                }
            }
            
            throw error;
        }
    }
    
    // === LIMPEZA DE DADOS ANTIGOS ===
    limparComprovantesAntigos() {
        const agora = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutos
        let removidos = 0;
        
        Object.keys(this.comprovantesMemorizados).forEach(remetente => {
            const comprovativo = this.comprovantesMemorizados[remetente];
            if (agora - comprovativo.timestamp > timeout) {
                delete this.comprovantesMemorizados[remetente];
                removidos++;
            }
        });
        
        if (removidos > 0) {
            console.log(`🗑️ DIVISÃO: ${removidos} comprovativos antigos removidos`);
        }
    }
    
    // === EXTRAIR TEXTO DE IMAGEM COM IA ===
    async extrairTextoDeImagem(message, grupoId) {
        try {
            console.log('📷 DIVISÃO: Iniciando extração de texto da imagem com IA...');
            
            // Verificar se IA está disponível
            if (!this.ia) {
                console.log('❌ DIVISÃO: IA não disponível para processar imagens');
                return null;
            }
            
            // Baixar a mídia
            const media = await message.downloadMedia();
            if (!media) {
                console.log('❌ DIVISÃO: Não foi possível baixar a mídia');
                return null;
            }
            
            console.log(`📷 DIVISÃO: Mídia baixada - Tipo: ${media.mimetype}, Tamanho: ${media.data.length} bytes`);
            
            // Verificar se é imagem
            if (!media.mimetype || !media.mimetype.startsWith('image/')) {
                console.log('❌ DIVISÃO: Arquivo não é uma imagem válida');
                return null;
            }
            
            // Criar configuração de grupo para a IA (usando dados do bot de divisão)
            const configGrupoParaIA = this.CONFIGURACAO_GRUPOS[grupoId] ? {
                tabela: this.gerarTabelaTextoParaIA(grupoId)
            } : null;
            
            // Usar a IA avançada para extrair comprovativo da imagem
            const resultadoIA = await this.ia.processarImagem(media.data, 'usuario_divisao', Date.now(), configGrupoParaIA, message.body || '');
            
            console.log(`🔍 DIVISÃO: Resultado completo da IA:`, JSON.stringify(resultadoIA, null, 2));
            
            if (resultadoIA && resultadoIA.sucesso) {
                // Se a IA já processou tudo (comprovativo + número único), retornar resultado direto
                if (resultadoIA.dadosCompletos) {
                    console.log(`✅ DIVISÃO: IA processou TUDO: ${resultadoIA.dadosCompletos}`);
                    return { processadoCompleto: true, resultado: resultadoIA };
                }
                
                // Se IA só extraiu comprovativo, simular texto para processamento normal
                if (resultadoIA.referencia && resultadoIA.valor) {
                    console.log(`✅ DIVISÃO: IA extraiu comprovativo: ${resultadoIA.referencia} - ${resultadoIA.valor}MT`);
                    const textoSimulado = `Confirmado ${resultadoIA.referencia} - Transferiste ${resultadoIA.valor}MT`;
                    return textoSimulado;
                }
            }
            
            // CASO ESPECIAL: IA rejeitou múltiplos números, mas nós queremos processá-los!
            if (resultadoIA && !resultadoIA.sucesso && resultadoIA.tipo === 'multiplos_numeros_nao_permitido') {
                console.log('🎯 DIVISÃO: IA detectou múltiplos números - extraindo só comprovativo!');
                console.log(`📱 DIVISÃO: Múltiplos números detectados: ${resultadoIA.numeros.join(', ')}`);
                
                // Extrair apenas o comprovativo usando prompt personalizado para divisão
                const comprovantivoIA = await this.extrairApenasComprovativo(media.data);
                
                if (comprovantivoIA && comprovantivoIA.referencia && comprovantivoIA.valor) {
                    console.log(`✅ DIVISÃO: Comprovativo extraído: ${comprovantivoIA.referencia} - ${comprovantivoIA.valor}MT`);
                    
                    // Simular texto com comprovativo + múltiplos números
                    const textoSimulado = `Confirmado ${comprovantivoIA.referencia} - Transferiste ${comprovantivoIA.valor}MT ${resultadoIA.numeros.join(' ')}`;
                    return textoSimulado;
                }
            }
            
            console.log('❌ DIVISÃO: IA não conseguiu extrair comprovativo da imagem');
            return null;
            
        } catch (error) {
            console.error('❌ DIVISÃO: Erro ao usar IA para extrair texto da imagem:', error);
            return null;
        }
    }

    // === EXTRAIR APENAS COMPROVATIVO (SEM NÚMEROS) ===
    async extrairApenasComprovativo(imagemBase64) {
        if (!this.ia) return null;
        
        try {
            console.log('🔍 DIVISÃO: Extraindo apenas comprovativo da imagem...');
            
            const prompt = `Analise esta imagem de comprovante M-Pesa/E-Mola de Moçambique.

FOQUE APENAS no comprovante - IGNORE todos os números de telefone.

Extraia:
- Referência da transação (ID da transação)
- Valor transferido em MT

⚠️ CRÍTICO: Mantenha maiúsculas e minúsculas EXATAMENTE como aparecem!

Responda APENAS no formato JSON:
{
  "referencia": "CHP2H5LBZAS",
  "valor": "250",
  "encontrado": true,
  "tipo": "mpesa"
}

Se não conseguir extrair:
{"encontrado": false}`;

            const response = await this.ia.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${imagemBase64}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.1,
                max_tokens: 300
            });
            
            console.log(`🔍 DIVISÃO: Resposta da IA (só comprovativo): ${response.choices[0].message.content}`);
            
            const resultado = this.ia.extrairJSONMelhorado(response.choices[0].message.content);
            
            if (resultado && resultado.encontrado) {
                return {
                    referencia: resultado.referencia,
                    valor: this.ia.limparValor(resultado.valor)
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ DIVISÃO: Erro ao extrair comprovativo:', error);
            return null;
        }
    }

    // === GERAR TABELA PARA IA ===
    gerarTabelaTextoParaIA(grupoId) {
        const configGrupo = this.CONFIGURACAO_GRUPOS[grupoId];
        if (!configGrupo || !configGrupo.precos) {
            return '';
        }
        
        let tabela = `📋 TABELA ${configGrupo.nome}:\n`;
        
        Object.entries(configGrupo.precos).forEach(([megas, preco]) => {
            const gb = Math.floor(megas / 1024);
            tabela += `${gb}GB➜${preco}MT\n`;
        });
        
        console.log(`📋 DIVISÃO: Tabela gerada para IA: ${tabela}`);
        return tabela;
    }

    // === ADICIONAR NÚMERO DE PAGAMENTO ===
    adicionarNumeroPagamento(grupoId, numero) {
        if (!this.CONFIGURACAO_GRUPOS[grupoId]) {
            console.log(`❌ DIVISÃO: Grupo ${grupoId} não existe`);
            return false;
        }
        
        if (!this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento) {
            this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento = [];
        }
        
        const numeroLimpo = this.limparNumero(numero);
        if (!this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento.includes(numeroLimpo)) {
            this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento.push(numeroLimpo);
            console.log(`✅ DIVISÃO: Número de pagamento ${numeroLimpo} adicionado ao grupo ${this.CONFIGURACAO_GRUPOS[grupoId].nome}`);
            return true;
        } else {
            console.log(`⚠️ DIVISÃO: Número ${numeroLimpo} já está na lista de pagamentos`);
            return false;
        }
    }

    // === STATUS DO BOT ===
    getStatus() {
        return {
            comprovantesMemorizados: Object.keys(this.comprovantesMemorizados).length,
            processandoDivisoes: this.processandoDivisoes.size,
            gruposConfigurados: Object.keys(this.CONFIGURACAO_GRUPOS).length,
            numerosPagamento: Object.keys(this.CONFIGURACAO_GRUPOS).reduce((acc, grupoId) => {
                const config = this.CONFIGURACAO_GRUPOS[grupoId];
                acc[config.nome] = config.numerosPagamento || [];
                return acc;
            }, {})
        };
    }
}

module.exports = WhatsAppBotDivisao;