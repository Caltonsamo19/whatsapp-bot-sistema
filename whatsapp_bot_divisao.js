const axios = require('axios');

class WhatsAppBotDivisao {
    constructor() {
        this.comprovantesMemorizados = {};
        this.processandoDivisoes = new Set();
        
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
                }
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
                this.comprovantesMemorizados[remetente] = {
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
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log(`📋 DIVISÃO: Resposta recebida:`, response.data);
            
            if (!response.data || !response.data.success) {
                const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                throw new Error(`Erro ao salvar pedido: ${responseText}`);
            }
            
            console.log(`✅ DIVISÃO: Pedido salvo com sucesso - ${referencia}|${megas}|${numero}`);
            
        } catch (error) {
            console.error(`❌ DIVISÃO: Erro ao enviar pedido:`, error.message);
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
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
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