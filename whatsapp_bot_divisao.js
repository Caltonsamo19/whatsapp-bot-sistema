const axios = require('axios');

class WhatsAppBotDivisao {
    constructor() {
        this.comprovantesMemorizados = {};
        this.processandoDivisoes = new Set();
        
        // Inicializar IA usando variável de ambiente (mesma do servidor)
        const WhatsAppAIAtacado = require('./whatsapp_ai_atacado');
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
                    '840326152',   // Número M-Pesa do VASCO (sem prefixo)
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
            const mensagem = message.body.trim();
            
            // Só processa grupos configurados
            if (!this.CONFIGURACAO_GRUPOS[grupoId]) {
                return null;
            }
            
            console.log(`\n🔍 DIVISÃO: Analisando mensagem de ${remetente}`);
            
            // 1. DETECTAR SE É COMPROVATIVO SEM NÚMEROS
            const comprovativo = this.extrairComprovativo(mensagem);
            if (comprovativo && !this.temNumeros(mensagem)) {
                console.log(`💰 DIVISÃO: Comprovativo memorizado: ${comprovativo.referencia} - ${comprovativo.valor}MT`);
                const remetenteNormalizado = this.normalizarRemetente(remetente);
                this.comprovantesMemorizados[remetenteNormalizado] = {
                    ...comprovativo,
                    timestamp: Date.now(),
                    grupoId: grupoId
                };
                return null; // Não responde ainda
            }
            
            // 2. DETECTAR MÚLTIPLOS NÚMEROS (para verificar se precisa processar)
            const numerosDetectados = this.extrairMultiplosNumeros(mensagem);
            
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
                const remetenteNormalizado = this.normalizarRemetente(remetente);
                let comprovantivoAssociado = this.comprovantesMemorizados[remetenteNormalizado];
                
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
        
        console.log(`🔍 DIVISÃO: temConfirmado: ${temConfirmado}, temID: ${temID}`);
        
        if (!temConfirmado && !temID) {
            console.log(`❌ DIVISÃO: Não é comprovativo (não começa com Confirmado ou ID)`);
            return null;
        }
        
        // Patterns para extrair referência e valor
        const patternsRef = [
            /Confirmado\s+([A-Z0-9]+)/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+\.[A-Z0-9]+)/i,
            /ID da transacao\s*:?\s*([A-Z0-9]+)/i
        ];
        
        const patternsValor = [
            /Transferiste\s+(\d+(?:[.,]\d+)?)MT/i,
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
    extrairMultiplosNumeros(mensagem) {
        const regex = /(?:\+258\s*)?8[0-9]{8}/g;
        const matches = mensagem.match(regex) || [];
        
        if (matches.length === 0) return null;
        
        // Limpar e filtrar números válidos
        const numerosLimpos = matches.map(num => this.limparNumero(num))
                                    .filter(num => num && /^8[0-9]{8}$/.test(num));
        
        // Remover duplicatas
        const numerosUnicos = [...new Set(numerosLimpos)];
        
        // === FILTRAR NÚMEROS QUE NÃO SÃO PARA DIVISÃO ===
        const numerosFiltrados = this.filtrarNumerosComprovante(numerosUnicos, mensagem);
        
        return numerosFiltrados.length > 0 ? numerosFiltrados : null;
    }
    
    // === FILTRAR NÚMEROS DE COMPROVANTE ===
    filtrarNumerosComprovante(numeros, mensagem) {
        return numeros.filter(numero => {
            // Números que aparecem em contextos de pagamento (M-Pesa/eMola) não são para divisão
            const contextosPagamento = [
                new RegExp(`para\\s+${numero}\\s*-`, 'i'),        // "para 840326152 - VASCO"
                new RegExp(`para\\s+${numero}\\s*,`, 'i'),        // "para 840326152, nome"
                new RegExp(`conta\\s+${numero}`, 'i'),            // "conta 840326152"
                new RegExp(`M-Pesa.*${numero}`, 'i'),             // "M-Pesa ... 840326152"
                new RegExp(`eMola.*${numero}`, 'i'),              // "eMola ... 840326152"
                new RegExp(`${numero}.*VASCO`, 'i'),              // "840326152 - VASCO"
                new RegExp(`${numero}.*Mahumane`, 'i'),           // números associados ao nome
                new RegExp(`Transferiste.*para\\s+${numero}`, 'i') // "Transferiste ... para 840326152"
            ];
            
            // Se o número aparece em contexto de pagamento, não é para divisão
            for (const padrao of contextosPagamento) {
                if (padrao.test(mensagem)) {
                    console.log(`🚫 DIVISÃO: ${numero} ignorado (contexto de pagamento)`);
                    return false;
                }
            }
            
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
        console.log(`🔍 DIVISÃO: Buscando comprovativo para remetente: ${remetente}`);
        console.log(`📋 DIVISÃO: Comprovativos memorizados:`, Object.keys(this.comprovantesMemorizados));
        
        // Normalizar o remetente atual para busca
        const remetenteNormalizado = this.normalizarRemetente(remetente);
        console.log(`🔄 DIVISÃO: Remetente normalizado para busca: ${remetenteNormalizado}`);
        
        // Buscar usando a chave normalizada
        const comprovativo = this.comprovantesMemorizados[remetenteNormalizado];
        // Verificar se ainda está dentro do prazo (30 min)
        if (comprovativo && (Date.now() - comprovativo.timestamp) <= 1800000) {
            console.log(`✅ DIVISÃO: Comprovativo encontrado dentro do prazo!`);
            console.log(`   Ref: ${comprovativo.referencia}, Valor: ${comprovativo.valor}MT`);
            return comprovativo;
        } else if (comprovativo) {
            const minutosExpiracao = (Date.now() - comprovativo.timestamp) / 60000;
            console.log(`❌ DIVISÃO: Comprovativo encontrado mas expirado (${minutosExpiracao.toFixed(1)} min)`);
        } else {
            console.log(`❌ DIVISÃO: Nenhum comprovativo encontrado para este remetente`);
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
            let duplicados = 0;
            let pedidosDuplicados = [];
            
            for (let i = 0; i < divisao.length; i++) {
                const { numero, megas, valorMT } = divisao[i];
                const novaRef = novasReferencias[i];
                
                try {
                    // PEDIDO na planilha de pedidos
                    const resultadoPedido = await this.enviarParaPlanilhaPedidos(novaRef, megas, numero, grupoId);
                    
                    // PAGAMENTO na planilha de pagamentos  
                    const resultadoPagamento = await this.enviarParaPlanilhaPagamentos(novaRef, valorMT, numero, grupoId);
                    
                    // Verificar se foram duplicados
                    if (resultadoPedido && resultadoPedido.duplicado) {
                        duplicados++;
                        pedidosDuplicados.push({
                            referencia: novaRef,
                            numero: numero,
                            status: resultadoPedido.status
                        });
                        console.log(`⚠️ DIVISÃO: ${novaRef} já existia (duplicado)`);
                    } else {
                        sucessos++;
                        console.log(`✅ DIVISÃO: ${novaRef} criado com sucesso`);
                    }
                    
                } catch (error) {
                    console.error(`❌ DIVISÃO: Erro ao criar ${novaRef}:`, error);
                }
            }
            
            // 6. LIMPAR DADOS E RESPONDER
            const remetenteLimpeza = this.normalizarRemetente(message.author || message.from);
            delete this.comprovantesMemorizados[remetenteLimpeza];
            
            // Criar mensagem final baseada no resultado
            let mensagemFinal = '';
            
            if (sucessos > 0 && duplicados === 0) {
                // Todos criados com sucesso
                mensagemFinal = `✅ *DIVISÃO CONCLUÍDA!*\n\n` +
                    `🎯 **${sucessos}/${divisao.length} pedidos criados**\n` +
                    `📊 Referências: ${novasReferencias.join(', ')}\n\n` +
                    `⏳ *O sistema principal processará as transferências em instantes...*`;
                    
            } else if (sucessos === 0 && duplicados > 0) {
                // Todos já existiam
                mensagemFinal = `⚠️ *DIVISÃO JÁ PROCESSADA*\n\n` +
                    `📋 **Todos os ${duplicados} pedidos já existem na planilha:**\n\n` +
                    pedidosDuplicados.map(p => 
                        `• ${p.referencia} (${p.numero}) - Status: ${p.status}`
                    ).join('\n') + 
                    `\n\n✅ *Não é necessário reprocessar - os pedidos já estão no sistema.*`;
                    
            } else if (sucessos > 0 && duplicados > 0) {
                // Alguns criados, alguns duplicados
                mensagemFinal = `⚠️ *DIVISÃO PARCIALMENTE PROCESSADA*\n\n` +
                    `✅ **${sucessos} pedidos criados com sucesso**\n` +
                    `⚠️ **${duplicados} pedidos já existiam:**\n\n` +
                    pedidosDuplicados.map(p => 
                        `• ${p.referencia} (${p.numero}) - Status: ${p.status}`
                    ).join('\n') + 
                    `\n\n📊 Total processado: ${sucessos + duplicados}/${divisao.length}`;
                    
            } else {
                // Erro geral
                mensagemFinal = `❌ *ERRO NA DIVISÃO*\n\n` +
                    `🚫 Nenhum pedido foi processado com sucesso\n` +
                    `📋 Verifique os logs para mais detalhes`;
            }
            
            // Aguardar um pouco antes da mensagem final
            setTimeout(async () => {
                try {
                    await message.reply(mensagemFinal);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem final:', error);
                }
            }, 2000);
            
            return { 
                processado: true, 
                sucessos, 
                duplicados, 
                total: divisao.length,
                pedidosDuplicados: pedidosDuplicados
            };
            
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
                dados: dadosCompletos,  // Para pedidos usar 'dados'
                sender: "WhatsApp-Bot-Divisao",
                message: `Pedido dividido: ${dadosCompletos}`
            };
            
            console.log(`📋 DIVISÃO: Dados:`, JSON.stringify(dados));
            
            const response = await axios.post(this.SCRIPTS_CONFIG.PEDIDOS, dados, {
                timeout: 20000, // Aumentado para 20 segundos
                headers: { 'Content-Type': 'application/json' },
                retry: 2 // Tentar novamente se falhar
            });
            
            console.log(`📋 DIVISÃO: Resposta recebida:`, response.data);
            
            // Verificar se é pedido duplicado (caso especial)
            if (response.data && response.data.duplicado) {
                console.log(`⚠️ DIVISÃO: Pedido ${referencia} já existe (Status: ${response.data.status_existente})`);
                return { duplicado: true, referencia, status: response.data.status_existente };
            }
            
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
                transacao: dadosCompletos,  // Para pagamentos usar 'transacao'
                sender: "WhatsApp-Bot-Divisao",
                message: `Pagamento dividido: ${dadosCompletos}`
            };
            
            console.log(`💰 DIVISÃO: Dados:`, JSON.stringify(dados));
            
            const response = await axios.post(this.SCRIPTS_CONFIG.PAGAMENTOS, dados, {
                timeout: 20000, // Aumentado para 20 segundos  
                headers: { 'Content-Type': 'application/json' },
                retry: 2 // Tentar novamente se falhar
            });
            
            console.log(`💰 DIVISÃO: Resposta recebida:`, response.data);
            
            // Verificar se é pagamento duplicado (caso especial)
            if (response.data && response.data.duplicado) {
                console.log(`⚠️ DIVISÃO: Pagamento ${referencia} já existe (Status: ${response.data.status_existente})`);
                return { duplicado: true, referencia, status: response.data.status_existente };
            }
            
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

    // === LIMPAR E NORMALIZAR NÚMERO ===
    limparNumero(numero) {
        if (!numero) return numero;
        
        // Remover caracteres especiais e espaços
        let numeroLimpo = numero.toString().replace(/\D/g, '');
        
        // Remover prefixo 258 se existir
        if (numeroLimpo.startsWith('258') && numeroLimpo.length > 9) {
            numeroLimpo = numeroLimpo.substring(3);
        }
        
        // Se após limpar sobrou um número que começa com 8 e tem 9 dígitos, retornar apenas os últimos 9
        if (/^8[0-9]{8,}$/.test(numeroLimpo) && numeroLimpo.length > 9) {
            numeroLimpo = numeroLimpo.slice(-9); // Pegar os últimos 9 dígitos
        }
        
        return numeroLimpo;
    }
    
    // === NORMALIZAR REMETENTE PARA ARMAZENAMENTO CONSISTENTE ===
    normalizarRemetente(remetente) {
        // Extrair apenas os dígitos e pegar os últimos 9 (número de telefone)
        const numerosApenas = remetente.replace(/\D/g, '');
        if (numerosApenas.length >= 9) {
            return numerosApenas.slice(-9); // Retorna apenas os últimos 9 dígitos
        }
        return remetente; // Se não conseguir normalizar, retorna original
    }

    // === EXTRAIR ESPECIFICAÇÕES DO CLIENTE ===
    extrairEspecificacoes(mensagem, numeros) {
        console.log(`🔍 DIVISÃO: Extraindo especificações da mensagem`);
        
        const especificacoes = {};
        const linhas = mensagem.split('\n').map(linha => linha.trim()).filter(linha => linha.length > 0);
        
        console.log(`   📄 Processando ${linhas.length} linhas da mensagem`);
        
        // Processar linha por linha para encontrar padrões
        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            console.log(`   🔍 Linha ${i + 1}: "${linha}"`);
            
            // Padrão 1: GB e número na mesma linha (ex: "10gb 852118624")
            const sameLinha = linha.match(/(\d+)\s*gb\s+(\d{9})/i);
            if (sameLinha) {
                const gb = parseInt(sameLinha[1]);
                const numero = sameLinha[2];
                
                if (numeros.includes(numero) && !especificacoes[numero]) {
                    especificacoes[numero] = gb * 1024;
                    console.log(`   ✅ Padrão mesma linha: ${numero} → ${gb}GB`);
                }
                continue; // Pular para próxima linha
            }
            
            // Padrão 2: Linha só com GB (ex: "10gb")
            const somenteGb = linha.match(/^(\d+)\s*gb\s*$/i);
            if (somenteGb) {
                const gb = parseInt(somenteGb[1]);
                console.log(`   🔍 GB detectado: ${gb}GB - procurando próximo número`);
                
                // Procurar o PRÓXIMO número que ainda não tem especificação
                for (let j = i + 1; j < linhas.length; j++) {
                    const linhaSeguinte = linhas[j];
                    const numeroMatch = linhaSeguinte.match(/^(\d{9})$/);
                    
                    if (numeroMatch) {
                        const numero = numeroMatch[1];
                        if (numeros.includes(numero) && !especificacoes[numero]) {
                            especificacoes[numero] = gb * 1024;
                            console.log(`   ✅ Padrão separado: ${numero} → ${gb}GB`);
                            break; // Parar na primeira correspondência
                        }
                    }
                }
                continue; // Pular para próxima linha
            }
        }
        
        console.log(`   📊 Especificações finais extraídas:`);
        Object.entries(especificacoes).forEach(([numero, megas]) => {
            console.log(`      • ${numero}: ${megas/1024}GB`);
        });
        
        return especificacoes;
    }
    
    // === STATUS DO BOT ===
    getStatus() {
        return {
            comprovantesMemorizados: Object.keys(this.comprovantesMemorizados).length,
            processandoDivisoes: this.processandoDivisoes.size,
            gruposConfigurados: Object.keys(this.CONFIGURACAO_GRUPOS).length
        };
    }
}

module.exports = WhatsAppBotDivisao;