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
    
    // === EXTRAIR MÚLTIPLOS NÚMEROS (LÓGICA INTELIGENTE PARA MÚLTIPLOS) ===
    extrairMultiplosNumeros(mensagem, grupoId = null) {
        const regex = /(?:\+258\s*)?8[0-9]{8}/g;
        const matches = mensagem.match(regex) || [];
        
        if (matches.length === 0) return null;
        
        console.log(`📱 DIVISÃO: ${matches.length} números brutos encontrados: [${matches.join(', ')}]`);
        
        const tamanhoMensagem = mensagem.length;
        
        // === NOVA LÓGICA INTELIGENTE ===
        // 1. Limpar e identificar posições de todos os números
        const numerosComPosicao = [];
        
        for (const numeroOriginal of matches) {
            const numeroLimpo = this.limparNumero(numeroOriginal);
            if (!numeroLimpo || !/^8[0-9]{8}$/.test(numeroLimpo)) continue;
            
            const posicao = mensagem.indexOf(numeroOriginal);
            const percentualPosicao = (posicao / tamanhoMensagem) * 100;
            
            numerosComPosicao.push({
                numeroLimpo,
                numeroOriginal,
                posicao,
                percentualPosicao
            });
        }
        
        if (numerosComPosicao.length === 0) return null;
        
        // 2. Verificar se existe bloco consecutivo de 3+ números
        const ehBlocoConsecutivo = numerosComPosicao.length >= 3 && this.verificarBlocoConsecutivoDivisao(mensagem, numerosComPosicao);
        
        console.log(`📱 DIVISÃO: É bloco consecutivo de múltiplos números: ${ehBlocoConsecutivo}`);
        
        const numerosValidos = [];
        const limiteInicioFinal = tamanhoMensagem * 0.7; // Últimos 30% da mensagem
        
        if (ehBlocoConsecutivo) {
            // CASO ESPECIAL: 3+ números consecutivos - aceitar todos exceto os claramente de pagamento
            console.log(`🎯 DIVISÃO: Processando bloco consecutivo de ${numerosComPosicao.length} números...`);
            
            for (const numeroInfo of numerosComPosicao) {
                const numeroLimpo = numeroInfo.numeroLimpo;
                const posicao = numeroInfo.posicao;
                
                const contextoBefore = mensagem.substring(Math.max(0, posicao - 50), posicao).toLowerCase();
                const contextoAfter = mensagem.substring(posicao + numeroInfo.numeroOriginal.length, posicao + numeroInfo.numeroOriginal.length + 50).toLowerCase();
                
                // Verificar apenas contextos MUITO específicos de pagamento
                const indicadoresPagamentoEspecificos = [
                    'transferiste', 'enviaste para', 'para o número', 'conta de', 'beneficiário',
                    'destinatário', 'pagamento para', 'para conta'
                ];
                
                const eNumeroPagamento = indicadoresPagamentoEspecificos.some(indicador => 
                    contextoBefore.includes(indicador) && contextoBefore.includes(numeroLimpo)
                );
                
                if (eNumeroPagamento) {
                    console.log(`❌ DIVISÃO: REJEITADO do bloco por contexto específico de pagamento: ${numeroLimpo}`);
                    continue;
                }
                
                numerosValidos.push(numeroLimpo);
                console.log(`✅ DIVISÃO: ACEITO do bloco consecutivo (${numeroInfo.percentualPosicao.toFixed(1)}%): ${numeroLimpo}`);
            }
            
        } else {
            // CASO NORMAL: 1-2 números - usar lógica de posição restritiva
            console.log(`📋 DIVISÃO: Processando números individuais com lógica de posição...`);
            
            for (const numeroInfo of numerosComPosicao) {
                const numeroLimpo = numeroInfo.numeroLimpo;
                const posicao = numeroInfo.posicao;
                const percentualPosicao = numeroInfo.percentualPosicao;
                
                console.log(`📱 DIVISÃO: Analisando ${numeroLimpo} na posição ${posicao}/${tamanhoMensagem} (${percentualPosicao.toFixed(1)}%)`);
                
                // Aplicar regra restritiva de posição para números individuais
                if (posicao < limiteInicioFinal) {
                    console.log(`❌ DIVISÃO: REJEITADO por estar no meio/início da mensagem: ${numeroLimpo} (posição ${percentualPosicao.toFixed(1)}%)`);
                    continue;
                }
                
                // Verificação adicional de contexto de pagamento
                const contextoBefore = mensagem.substring(Math.max(0, posicao - 30), posicao).toLowerCase();
                const contextoAfter = mensagem.substring(posicao + numeroInfo.numeroOriginal.length, posicao + numeroInfo.numeroOriginal.length + 30).toLowerCase();
                
                const indicadoresPagamento = [
                    'transferiste', 'taxa foi', 'para o número', 'para número', 'para conta',
                    'conta de', 'beneficiário', 'destinatario', 'nome:', 'para 8',
                    'enviaste para', 'pagamento para', 'destinatário'
                ];
                
                const eNumeroPagamento = indicadoresPagamento.some(indicador => 
                    contextoBefore.includes(indicador) || contextoAfter.includes(indicador)
                );
                
                if (eNumeroPagamento) {
                    console.log(`❌ DIVISÃO: REJEITADO por contexto de pagamento: ${numeroLimpo}`);
                    continue;
                }
                
                numerosValidos.push(numeroLimpo);
                console.log(`✅ DIVISÃO: ACEITO por estar no final da mensagem (${percentualPosicao.toFixed(1)}%): ${numeroLimpo}`);
            }
        }
        
        // Remover duplicatas
        const numerosUnicos = [...new Set(numerosValidos)];
        
        // === FILTRAR NÚMEROS DE PAGAMENTO DO GRUPO ===
        const numerosFiltrados = this.filtrarNumerosPagamentoGrupo(numerosUnicos, grupoId);
        
        console.log(`📱 DIVISÃO: ${numerosUnicos.length} números únicos processados: [${numerosUnicos.join(', ')}]`);
        console.log(`📱 DIVISÃO: ${numerosFiltrados.length} números aceitos para divisão: [${numerosFiltrados.join(', ')}]`);
        
        return numerosFiltrados.length > 0 ? numerosFiltrados : null;
    }
    
    // Função auxiliar para verificar blocos consecutivos na divisão
    verificarBlocoConsecutivoDivisao(mensagem, numerosComPosicao) {
        if (numerosComPosicao.length < 3) return false;
        
        // Ordenar por posição
        const posicoes = [...numerosComPosicao].sort((a, b) => a.posicao - b.posicao);
        
        // Verificar se há pelo menos 3 números próximos (com no máximo 50 caracteres entre eles)
        let numerosConsecutivos = 1;
        let maiorSequencia = 1;
        
        for (let i = 1; i < posicoes.length; i++) {
            const fimAnterior = posicoes[i-1].posicao + posicoes[i-1].numeroOriginal.length;
            const inicioAtual = posicoes[i].posicao;
            const distancia = inicioAtual - fimAnterior;
            
            // Se a distância é pequena (máx 50 caracteres), considera consecutivo
            if (distancia <= 50) {
                numerosConsecutivos++;
                maiorSequencia = Math.max(maiorSequencia, numerosConsecutivos);
            } else {
                numerosConsecutivos = 1;
            }
        }
        
        const ehConsecutivo = maiorSequencia >= 3;
        console.log(`📊 DIVISÃO: Maior sequência consecutiva: ${maiorSequencia} números (limite: 3)`);
        
        return ehConsecutivo;
    }
    
    // === FILTRAR NÚMEROS DE PAGAMENTO DO GRUPO ===
    filtrarNumerosPagamentoGrupo(numeros, grupoId = null) {
        return numeros.filter(numero => {
            // VERIFICAR SE É NÚMERO DE PAGAMENTO DO GRUPO
            if (grupoId && this.CONFIGURACAO_GRUPOS[grupoId] && this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento) {
                const numerosPagamentoGrupo = this.CONFIGURACAO_GRUPOS[grupoId].numerosPagamento;
                // Testar número completo e versões sem prefixo
                const numeroSemPrefixo = numero.length > 9 ? numero.substring(numero.length - 9) : numero;
                const numeroCompleto = numero.startsWith('258') ? numero : '258' + numero;
                
                if (numerosPagamentoGrupo.includes(numero) || 
                    numerosPagamentoGrupo.includes(numeroSemPrefixo) || 
                    numerosPagamentoGrupo.includes(numeroCompleto)) {
                    console.log(`🚫 DIVISÃO: ${numero} ignorado (número de pagamento do grupo)`);
                    return false;
                }
            }
            
            console.log(`✅ DIVISÃO: ${numero} aceito para divisão`);
            return true; // Número válido para divisão
        });
    }
    
    // === FILTRAR NÚMEROS DE COMPROVANTE (MANTIDA PARA COMPATIBILIDADE) ===
    filtrarNumerosComprovante(numeros, mensagem, grupoId = null) {
        // Esta função agora apenas chama a nova função simplificada
        return this.filtrarNumerosPagamentoGrupo(numeros, grupoId);
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
        
        // Mostrar detalhes dos comprovativos memorizados
        const chaves = Object.keys(this.comprovantesMemorizados);
        console.log(`📋 DIVISÃO: ${chaves.length} comprovativos memorizados:`);
        chaves.forEach(chave => {
            const comp = this.comprovantesMemorizados[chave];
            const idade = ((Date.now() - comp.timestamp) / 60000).toFixed(1);
            console.log(`   • ${chave}: ${comp.referencia} (${comp.valor}MT) - ${idade}min atrás`);
        });
        
        // Normalizar o remetente atual para busca
        const remetenteNormalizado = this.normalizarRemetente(remetente);
        console.log(`🔄 DIVISÃO: Remetente original: ${remetente}`);
        console.log(`🔄 DIVISÃO: Remetente normalizado: ${remetenteNormalizado}`);
        
        // Buscar usando a chave normalizada
        const comprovativo = this.comprovantesMemorizados[remetenteNormalizado];
        // Verificar se ainda está dentro do prazo (30 min)
        if (comprovativo && (Date.now() - comprovativo.timestamp) <= 1800000) {
            console.log(`✅ DIVISÃO: Comprovativo encontrado dentro do prazo!`);
            console.log(`   Ref: ${comprovativo.referencia}, Valor: ${comprovativo.valor}MT, Fonte: ${comprovativo.fonte || 'não definida'}`);
            return comprovativo;
        } else if (comprovativo) {
            const minutosExpiracao = (Date.now() - comprovativo.timestamp) / 60000;
            console.log(`❌ DIVISÃO: Comprovativo encontrado mas expirado (${minutosExpiracao.toFixed(1)} min)`);
        } else {
            console.log(`❌ DIVISÃO: Nenhum comprovativo encontrado para remetente normalizado "${remetenteNormalizado}"`);
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
            
            // 1. VALIDAR PAGAMENTO COM MATCHING INTELIGENTE
            console.log(`🔐 DIVISÃO: Iniciando validação de pagamento...`);
            
            const validacao = await this.validarPagamentoDivisao(comprovativo.referencia, numeros, grupoId);
            
            if (!validacao.valido) {
                console.log(`❌ DIVISÃO: Validação falhou - ${validacao.erro}`);
                return {
                    resposta: `❌ *PAGAMENTO NÃO VALIDADO*\n\n💰 Referência: ${comprovativo.referencia}\n💳 Valor esperado: ${validacao.valorEsperado || comprovativo.valor}MT\n\n🔍 ${validacao.erro}\n\n${validacao.detalhes ? `📋 ${validacao.detalhes}\n\n` : ''}💡 Verifique se o pagamento foi processado corretamente.`
                };
            }
            
            console.log(`✅ DIVISÃO: Pagamento validado - ${validacao.mensagem}`);
            
            // Atualizar valor do comprovativo se necessário (caso tenha sido encontrado similar)
            if (validacao.valorPago !== parseFloat(comprovativo.valor)) {
                console.log(`🔄 DIVISÃO: Atualizando valor de ${comprovativo.valor}MT para ${validacao.valorPago}MT`);
                comprovativo.valor = validacao.valorPago;
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
                    
                    // Verificar se foram duplicados (tanto pedido quanto pagamento)
                    const pedidoDuplicado = resultadoPedido && resultadoPedido.duplicado;
                    const pagamentoDuplicado = resultadoPagamento && resultadoPagamento.duplicado;
                    
                    if (pedidoDuplicado || pagamentoDuplicado) {
                        duplicados++;
                        pedidosDuplicados.push({
                            referencia: novaRef,
                            numero: numero,
                            status: pedidoDuplicado ? resultadoPedido.status : 
                                   (pagamentoDuplicado ? resultadoPagamento.status : 'Existente')
                        });
                        console.log(`⚠️ DIVISÃO: ${novaRef} já existia (duplicado)`);
                    } else {
                        sucessos++;
                        console.log(`✅ DIVISÃO: ${novaRef} criado com sucesso`);
                    }
                    
                } catch (error) {
                    console.error(`❌ DIVISÃO: Erro ao processar ${novaRef}:`, error);
                    
                    // Se o erro for relacionado a duplicata, tratar como duplicado
                    if (error.message && (error.message.includes('Duplicado') || error.message.includes('já existe'))) {
                        duplicados++;
                        pedidosDuplicados.push({
                            referencia: novaRef,
                            numero: numero,
                            status: 'Existente'
                        });
                        console.log(`⚠️ DIVISÃO: ${novaRef} já existia (duplicado - detectado por erro)`);
                    } else {
                        // Erro real - não incrementar contadores, apenas registrar
                        console.error(`❌ DIVISÃO: Erro não relacionado a duplicata em ${novaRef}:`, error.message);
                        // Você pode adicionar uma variável para contar erros se necessário
                    }
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
                // Todos já existiam - mensagem personalizada por status
                const pedidosPendentes = pedidosDuplicados.filter(p => 
                    p.status === 'Pendente' || p.status === 'PENDENTE' || 
                    p.status === 'Em Processamento' || p.status === 'Aguardando'
                );
                const pedidosProcessados = pedidosDuplicados.filter(p => 
                    p.status === 'Processado' || p.status === 'PROCESSADO' || 
                    p.status === 'Concluído' || p.status === 'Completo' ||
                    p.status === 'Finalizado' || p.status === 'Executado'
                );
                const pedidosOutrosStatus = pedidosDuplicados.filter(p => 
                    !pedidosPendentes.includes(p) && !pedidosProcessados.includes(p)
                );
                
                if (pedidosPendentes.length === duplicados) {
                    // Todos pendentes
                    mensagemFinal = `⏳ *PEDIDOS JÁ EM PROCESSAMENTO*\n\n` +
                        `📋 **${duplicados} pedidos já estão na planilha:**\n\n` +
                        pedidosDuplicados.map(p => 
                            `• ${p.referencia} (${p.numero}) - Status: ${p.status}`
                        ).join('\n') + 
                        `\n\n⏳ *Aguarde o processamento automático.*\n` +
                        `🔄 As transferências serão executadas em breve!`;
                } else if (pedidosProcessados.length === duplicados) {
                    // Todos processados
                    mensagemFinal = `✅ *DIVISÃO JÁ PROCESSADA ANTERIORMENTE*\n\n` +
                        `📋 **${duplicados} pedidos já foram executados:**\n\n` +
                        pedidosDuplicados.map(p => 
                            `• ${p.referencia} (${p.numero}) - Status: ${p.status}`
                        ).join('\n') + 
                        `\n\n✅ *Os pedidos já foram concluídos anteriormente.*`;
                } else {
                    // Status misto
                    mensagemFinal = `⚠️ *PEDIDOS JÁ EXISTEM COM STATUS VARIADOS*\n\n` +
                        `📋 **${duplicados} pedidos encontrados:**\n\n`;
                    
                    if (pedidosPendentes.length > 0) {
                        mensagemFinal += `⏳ **Pendentes (${pedidosPendentes.length}):**\n` +
                            pedidosPendentes.map(p => `• ${p.referencia} (${p.numero})`).join('\n') + '\n\n';
                    }
                    
                    if (pedidosProcessados.length > 0) {
                        mensagemFinal += `✅ **Processados (${pedidosProcessados.length}):**\n` +
                            pedidosProcessados.map(p => `• ${p.referencia} (${p.numero})`).join('\n') + '\n\n';
                    }
                    
                    if (pedidosOutrosStatus.length > 0) {
                        mensagemFinal += `📋 **Outros (${pedidosOutrosStatus.length}):**\n` +
                            pedidosOutrosStatus.map(p => `• ${p.referencia} (${p.numero}) - ${p.status}`).join('\n') + '\n\n';
                    }
                    
                    mensagemFinal += `🔍 *Verifique os status individuais acima.*`;
                }
                    
            } else if (sucessos > 0 && duplicados > 0) {
                // Alguns criados, alguns duplicados - mensagem detalhada
                mensagemFinal = `⚠️ *DIVISÃO PARCIALMENTE PROCESSADA*\n\n` +
                    `✅ **${sucessos} pedidos criados com sucesso**\n` +
                    `📋 **${duplicados} pedidos já existiam:**\n\n`;
                
                // Agrupar duplicados por status
                const duplicadosPorStatus = {};
                pedidosDuplicados.forEach(p => {
                    const status = p.status || 'Existente';
                    if (!duplicadosPorStatus[status]) {
                        duplicadosPorStatus[status] = [];
                    }
                    duplicadosPorStatus[status].push(p);
                });
                
                // Mostrar duplicados agrupados por status
                Object.entries(duplicadosPorStatus).forEach(([status, pedidos]) => {
                    const emoji = status.toLowerCase().includes('pendent') || status.toLowerCase().includes('aguard') ? '⏳' : 
                                 status.toLowerCase().includes('process') || status.toLowerCase().includes('conclu') ? '✅' : '📋';
                    mensagemFinal += `${emoji} **${status} (${pedidos.length}):**\n` +
                        pedidos.map(p => `• ${p.referencia} (${p.numero})`).join('\n') + '\n\n';
                });
                
                mensagemFinal += `📊 **Resumo:** ${sucessos} novos + ${duplicados} existentes = ${sucessos + duplicados}/${divisao.length} total`;
                    
            } else {
                // Erro geral - fornecer mais contexto
                if (duplicados > 0) {
                    // Se teve duplicados mas nenhum sucesso, tratar como duplicados
                    mensagemFinal = `⚠️ *ERRO NO PROCESSAMENTO*\n\n` +
                        `🚫 Não foi possível processar os pedidos\n` +
                        `📋 **${duplicados} pedidos com problemas:**\n\n` +
                        pedidosDuplicados.map(p => 
                            `• ${p.referencia} (${p.numero}) - Status: ${p.status}`
                        ).join('\n') + 
                        `\n\n🔄 *Tente novamente ou contate o suporte.*`;
                } else {
                    // Erro geral sem duplicados
                    mensagemFinal = `❌ *ERRO NA DIVISÃO*\n\n` +
                        `🚫 Nenhum pedido foi processado com sucesso\n` +
                        `⚠️ Possíveis causas:\n` +
                        `• Problema de conectividade\n` +
                        `• Erro nos dados de pagamento\n` +
                        `• Falha temporária do sistema\n\n` +
                        `🔄 *Tente novamente em alguns instantes.*`;
                }
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
    
    // === SISTEMA DE VALIDAÇÃO PARA DIVISÃO ===
    
    // Função para calcular diferenças entre referências (mesmo que no index.js)
    calcularDiferencasReferencia(ref1, ref2) {
        if (ref1.length !== ref2.length) return 999; // Só aceita mesmo comprimento
        
        let diferencas = 0;
        for (let i = 0; i < ref1.length; i++) {
            if (ref1[i].toLowerCase() !== ref2[i].toLowerCase()) {
                diferencas++;
                if (diferencas > 2) return diferencas; // Early exit se > 2
            }
        }
        return diferencas;
    }
    
    // Função para buscar pagamento com matching inteligente (adaptada para divisão)
    async buscarPagamentoComMatchingDivisao(referencia, valorEsperado) {
        console.log(`🔍 DIVISÃO-VALIDAÇÃO: Buscando pagamento ${referencia} - ${valorEsperado}MT`);
        
        try {
            const response = await axios.post(this.SCRIPTS_CONFIG.PAGAMENTOS, {
                action: "buscar_pagamentos_todos", // Buscar todos os pagamentos para fazer matching
            }, {
                timeout: 20000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.data || !response.data.pagamentos) {
                console.log(`❌ DIVISÃO-VALIDAÇÃO: Erro na resposta da planilha`);
                return { encontrado: false, erro: "Erro ao acessar planilha de pagamentos" };
            }
            
            const pagamentos = response.data.pagamentos;
            console.log(`📊 DIVISÃO-VALIDAÇÃO: ${pagamentos.length} pagamentos encontrados na planilha`);
            
            // 1. BUSCA EXATA primeiro
            const pagamentoExato = pagamentos.find(p => 
                p.referencia && p.referencia.toLowerCase() === referencia.toLowerCase()
            );
            
            if (pagamentoExato) {
                console.log(`✅ DIVISÃO-VALIDAÇÃO: Referência EXATA encontrada: ${pagamentoExato.referencia}`);
                const valorPago = parseFloat(pagamentoExato.valor) || 0;
                
                if (Math.abs(valorPago - valorEsperado) <= 5) { // Tolerância de 5MT
                    console.log(`✅ DIVISÃO-VALIDAÇÃO: Valor correto - Pago: ${valorPago}MT, Esperado: ${valorEsperado}MT`);
                    return { 
                        encontrado: true, 
                        pagamento: pagamentoExato, 
                        matchType: 'exato',
                        valorPago: valorPago 
                    };
                } else {
                    console.log(`❌ DIVISÃO-VALIDAÇÃO: Valor incorreto - Pago: ${valorPago}MT, Esperado: ${valorEsperado}MT`);
                    return { 
                        encontrado: false, 
                        erro: `Valor incorreto. Pago: ${valorPago}MT, Esperado: ${valorEsperado}MT`,
                        referenciaEncontrada: pagamentoExato.referencia 
                    };
                }
            }
            
            // 2. BUSCA SIMILAR se não encontrou exato
            console.log(`⚠️ DIVISÃO-VALIDAÇÃO: Referência exata não encontrada, buscando similares...`);
            
            const candidatos = [];
            
            for (const pagamento of pagamentos) {
                if (!pagamento.referencia) continue;
                
                const diferencas = this.calcularDiferencasReferencia(referencia, pagamento.referencia);
                
                if (diferencas <= 2 && diferencas > 0) { // 1 ou 2 diferenças
                    candidatos.push({
                        pagamento: pagamento,
                        diferencas: diferencas,
                        valorPago: parseFloat(pagamento.valor) || 0
                    });
                    console.log(`🔍 DIVISÃO-VALIDAÇÃO: Candidato similar: ${pagamento.referencia} (${diferencas} diferenças)`);
                }
            }
            
            if (candidatos.length === 0) {
                console.log(`❌ DIVISÃO-VALIDAÇÃO: Nenhuma referência similar encontrada`);
                return { encontrado: false, erro: "Pagamento não encontrado na planilha" };
            }
            
            // Ordenar candidatos por menor número de diferenças
            candidatos.sort((a, b) => a.diferencas - b.diferencas);
            
            // Verificar o melhor candidato
            const melhorCandidato = candidatos[0];
            console.log(`🎯 DIVISÃO-VALIDAÇÃO: Melhor candidato: ${melhorCandidato.pagamento.referencia} (${melhorCandidato.diferencas} diferenças)`);
            
            if (Math.abs(melhorCandidato.valorPago - valorEsperado) <= 5) { // Tolerância de 5MT
                console.log(`✅ DIVISÃO-VALIDAÇÃO: Referência SIMILAR aceita com valor correto`);
                return { 
                    encontrado: true, 
                    pagamento: melhorCandidato.pagamento, 
                    matchType: 'similar',
                    diferencas: melhorCandidato.diferencas,
                    valorPago: melhorCandidato.valorPago,
                    referenciaOriginal: referencia,
                    referenciaEncontrada: melhorCandidato.pagamento.referencia
                };
            } else {
                console.log(`❌ DIVISÃO-VALIDAÇÃO: Referência similar encontrada mas valor incorreto`);
                return { 
                    encontrado: false, 
                    erro: `Referência similar encontrada (${melhorCandidato.pagamento.referencia}) mas valor incorreto. Pago: ${melhorCandidato.valorPago}MT, Esperado: ${valorEsperado}MT`,
                    referenciaEncontrada: melhorCandidato.pagamento.referencia 
                };
            }
            
        } catch (error) {
            console.error(`❌ DIVISÃO-VALIDAÇÃO: Erro ao buscar pagamento:`, error.message);
            return { encontrado: false, erro: "Erro de conexão com a planilha" };
        }
    }
    
    // Função principal de validação para divisão
    async validarPagamentoDivisao(referencia, numeros, grupoId) {
        console.log(`\n🔐 DIVISÃO-VALIDAÇÃO: Iniciando validação de pagamento`);
        console.log(`📋 Referência: ${referencia}`);
        console.log(`📱 Números: ${numeros.join(', ')}`);
        console.log(`🏢 Grupo: ${grupoId}`);
        
        // 1. Calcular valor esperado baseado na configuração do grupo
        const valorEsperado = this.calcularValorEsperadoDivisao(numeros, grupoId);
        if (!valorEsperado) {
            return {
                valido: false,
                erro: "Não foi possível calcular valor esperado para este grupo",
                detalhes: "Verifique se o grupo está configurado corretamente"
            };
        }
        
        // 2. Buscar pagamento na planilha com matching
        const resultadoBusca = await this.buscarPagamentoComMatchingDivisao(referencia, valorEsperado.valorTotal);
        
        if (!resultadoBusca.encontrado) {
            return {
                valido: false,
                erro: resultadoBusca.erro,
                valorEsperado: valorEsperado.valorTotal,
                detalhes: resultadoBusca.referenciaEncontrada ? 
                    `Referência encontrada: ${resultadoBusca.referenciaEncontrada}` : 
                    "Nenhuma referência similar encontrada"
            };
        }
        
        // 3. Validação bem-sucedida
        console.log(`✅ DIVISÃO-VALIDAÇÃO CONCLUÍDA COM SUCESSO`);
        
        let mensagemSucesso = `Pagamento validado com sucesso!`;
        if (resultadoBusca.matchType === 'similar') {
            mensagemSucesso += ` (Referência similar: ${resultadoBusca.referenciaEncontrada})`;
        }
        
        return {
            valido: true,
            pagamento: resultadoBusca.pagamento,
            valorPago: resultadoBusca.valorPago,
            valorEsperado: valorEsperado.valorTotal,
            valorPorNumero: valorEsperado.valorPorNumero,
            matchType: resultadoBusca.matchType,
            mensagem: mensagemSucesso,
            detalhes: {
                referenciaOriginal: referencia,
                referenciaEncontrada: resultadoBusca.referenciaEncontrada || referencia,
                diferencas: resultadoBusca.diferencas || 0
            }
        };
    }
    
    // Função para calcular valor esperado na divisão
    calcularValorEsperadoDivisao(numeros, grupoId) {
        const configGrupo = this.CONFIGURACAO_GRUPOS[grupoId];
        if (!configGrupo || !configGrupo.precos) {
            console.log(`❌ DIVISÃO-VALIDAÇÃO: Grupo ${grupoId} não configurado`);
            return null;
        }
        
        const numNumeros = numeros.length;
        console.log(`📊 DIVISÃO-VALIDAÇÃO: Calculando valor para ${numNumeros} número(s)`);
        
        // Buscar valores que sejam múltiplos do número de números
        const opcoesDivisao = [];
        
        for (const [megas, preco] of Object.entries(configGrupo.precos)) {
            if (preco % numNumeros === 0) { // Divisível exatamente
                opcoesDivisao.push({
                    precoTotal: preco,
                    precoPorNumero: preco / numNumeros,
                    megas: parseInt(megas)
                });
            }
        }
        
        if (opcoesDivisao.length > 0) {
            // Usar a primeira opção válida
            const opcaoEscolhida = opcoesDivisao[0];
            console.log(`✅ DIVISÃO-VALIDAÇÃO: Valor esperado calculado: ${opcaoEscolhida.precoTotal}MT (${opcaoEscolhida.precoPorNumero}MT por número)`);
            return {
                valorTotal: opcaoEscolhida.precoTotal,
                valorPorNumero: opcaoEscolhida.precoPorNumero,
                opcoes: opcoesDivisao
            };
        }
        
        // Se não encontrou divisão exata, usar valor estimado
        const precos = Object.values(configGrupo.precos);
        const precoMedio = precos.reduce((sum, p) => sum + p, 0) / precos.length;
        const valorEstimado = Math.round(precoMedio * numNumeros / 50) * 50; // Arredondar para 50s
        
        console.log(`⚠️ DIVISÃO-VALIDAÇÃO: Usando valor estimado: ${valorEstimado}MT`);
        return {
            valorTotal: valorEstimado,
            valorPorNumero: Math.round(valorEstimado / numNumeros),
            estimado: true
        };
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
            
            // Verificar se é pagamento duplicado (múltiplos formatos)
            if (response.data && response.data.duplicado) {
                const status = response.data.status_existente || 'Existente';
                console.log(`⚠️ DIVISÃO: Pagamento ${referencia} já existe (Status: ${status})`);
                return { duplicado: true, referencia, status };
            }
            
            // Verificar formato de string "Duplicado! REFERENCIA [IGNORADO]"
            if (typeof response.data === 'string' && response.data.includes('Duplicado!')) {
                console.log(`⚠️ DIVISÃO: Pagamento ${referencia} já existe (formato string)`);
                // Tentar extrair status da mensagem se disponível
                const statusMatch = response.data.match(/\[([^\]]+)\]/);
                const status = statusMatch ? statusMatch[1] : 'Existente';
                return { duplicado: true, referencia, status };
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
        // Verificar se remetente é válido
        if (!remetente || typeof remetente !== 'string') {
            console.log(`⚠️ DIVISÃO: Remetente inválido para normalização: ${remetente}`);
            return 'remetente_indefinido';
        }
        
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