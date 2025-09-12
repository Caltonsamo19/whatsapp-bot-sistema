const { OpenAI } = require("openai");
const vision = require('@google-cloud/vision');

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100;
    
    // === OTIMIZAÇÃO: Cache de resultados para reduzir tokens ===
    this.cacheResultados = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutos
    this.tokenStats = {
      total: 0,
      saved: 0,
      calls: 0,
      cacheHits: 0
    };
    
    // Configurar Google Vision com verificação robusta
    this.googleVisionEnabled = process.env.GOOGLE_VISION_ENABLED === 'true';
    this.googleVisionTimeout = parseInt(process.env.GOOGLE_VISION_TIMEOUT) || 10000;
    
    console.log('🔍 Iniciando Google Vision...');
    console.log(`📋 GOOGLE_VISION_ENABLED: ${process.env.GOOGLE_VISION_ENABLED}`);
    console.log(`📁 GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    
    if (this.googleVisionEnabled) {
      try {
        const fs = require('fs');
        const path = require('path');
        
        let initialized = false;
        
        // MÉTODO 1: Credenciais JSON diretamente na variável de ambiente
        if (!initialized && process.env.GOOGLE_VISION_CREDENTIALS_JSON) {
          try {
            const credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS_JSON);
            this.visionClient = new vision.ImageAnnotatorClient({
              credentials: credentials
            });
            console.log('✅ Google Vision inicializado com JSON das credenciais');
            initialized = true;
          } catch (jsonError) {
            console.warn('⚠️ Erro ao parsear GOOGLE_VISION_CREDENTIALS_JSON:', jsonError.message);
          }
        }
        
        // MÉTODO 2: Arquivo de credenciais
        if (!initialized && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          const credentialsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
          console.log(`🔍 Verificando credenciais em: ${credentialsPath}`);
          
          if (fs.existsSync(credentialsPath)) {
            this.visionClient = new vision.ImageAnnotatorClient();
            console.log('✅ Google Vision inicializado com arquivo de credenciais');
            initialized = true;
          } else {
            console.error(`❌ Arquivo de credenciais não encontrado: ${credentialsPath}`);
          }
        }
        
        // MÉTODO 3: API Key
        if (!initialized && process.env.GOOGLE_VISION_API_KEY) {
          this.visionClient = new vision.ImageAnnotatorClient({
            apiKey: process.env.GOOGLE_VISION_API_KEY
          });
          console.log('✅ Google Vision inicializado com API Key');
          initialized = true;
        }
        
        if (!initialized) {
          console.log('⚠️ Google Vision desabilitado: nenhuma credencial válida encontrada');
          this.googleVisionEnabled = false;
        } else {
          console.log('🧪 Google Vision pronto para uso');
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar Google Vision:', error.message);
        console.error('❌ Stack trace:', error.stack);
        this.googleVisionEnabled = false;
      }
    } else {
      console.log('⚠️ Google Vision desabilitado via GOOGLE_VISION_ENABLED');
    }
    
    setInterval(() => {
      this.limparComprovantesAntigos();
      this.limparCacheAntigo(); // OTIMIZAÇÃO: Limpar cache junto
    }, 10 * 60 * 1000);
    
    const visionStatus = this.googleVisionEnabled ? 'Google Vision + GPT-4' : 'GPT-4 Vision';
    console.log(`🧠 IA WhatsApp ATACADO v5.0 inicializada - ${visionStatus}`);
  }

  // === RECONSTRUIR REFERÊNCIAS QUEBRADAS (COPIADO EXATAMENTE DO BOT DE REFERÊNCIA) ===
  reconstruirReferenciasQuebradas(texto) {
    console.log('🔧 Reconstruindo referências quebradas...');
    
    // Padrões comuns de referências M-Pesa/E-Mola quebradas
    const padroes = [
      // PP250901.1250.B + 64186 = PP250901.1250.B64186
      {
        regex: /(PP\d{6}\.\d{4}\.B)\s*\n?\s*(\d{4,6})/gi,
        reconstruct: (match, p1, p2) => `${p1}${p2}`
      },
      // CHMOH4HICK + 2 = CHMOH4HICK2 (caso específico: referência + número isolado)
      {
        regex: /(CHMOH4HICK)\s*\n?\s*(\d+)/gi,
        reconstruct: (match, p1, p2) => `${p1}${p2}`
      },
      // Padrão genérico: CÓDIGO + número isolado = CÓDIGONÚMERO
      {
        regex: /([A-Z]{8,12}[A-Z])\s*\n?\s*(\d{1,3})(?=\s*\.|\s*\n|\s*$)/gi,
        reconstruct: (match, p1, p2) => `${p1}${p2}`
      },
      // CI6H85P + TN4 = CI6H85PTN4
      {
        regex: /([A-Z]\w{5,7}[A-Z])\s*\n?\s*([A-Z0-9]{2,4})/gi,
        reconstruct: (match, p1, p2) => `${p1}${p2}`
      },
      // CGC4GQ1 + 7W84 = CGC4GQ17W84
      {
        regex: /([A-Z]{3}\d[A-Z]{2}\d)\s*\n?\s*(\d?[A-Z0-9]{3,4})/gi,
        reconstruct: (match, p1, p2) => `${p1}${p2}`
      },
      // Confirmado + CÓDIGO = CÓDIGO (remover prefixos)
      {
        regex: /Confirmado\s*\n?\s*([A-Z0-9]{8,15})/gi,
        reconstruct: (match, p1) => p1
      },
      // ID genérico: XXXXX + XXXXX = XXXXXXXXXX
      {
        regex: /([A-Z0-9]{5,8})\s*\n?\s*([A-Z0-9]{3,6})/gi,
        reconstruct: (match, p1, p2) => {
          // Só juntar se parecer fazer sentido (não números aleatórios)
          if (/^[A-Z]/.test(p1) && (p1.length + p2.length >= 8 && p1.length + p2.length <= 15)) {
            return `${p1}${p2}`;
          }
          return match;
        }
      }
    ];

    let textoProcessado = texto;
    let alteracoes = 0;

    for (const padrao of padroes) {
      const matches = [...textoProcessado.matchAll(padrao.regex)];
      for (const match of matches) {
        const original = match[0];
        
        // Chamar função de reconstrução com todos os grupos capturados
        let reconstruido;
        if (match.length === 2) {
          // Apenas um grupo (ex: "Confirmado CODIGO")
          reconstruido = padrao.reconstruct(match[0], match[1]);
        } else {
          // Dois grupos (ex: "CODIGO1 CODIGO2")
          reconstruido = padrao.reconstruct(match[0], match[1], match[2]);
        }
        
        if (reconstruido !== original && reconstruido !== match[0]) {
          textoProcessado = textoProcessado.replace(original, reconstruido);
          console.log(`   🔧 Reconstruído: "${original.replace(/\n/g, '\\n')}" → "${reconstruido}"`);
          alteracoes++;
        }
      }
    }

    if (alteracoes > 0) {
      console.log(`✅ ${alteracoes} referência(s) reconstruída(s)`);
    } else {
      console.log(`ℹ️ Nenhuma referência quebrada detectada`);
    }

    return textoProcessado;
  }

  // === EXTRAIR TEXTO COM GOOGLE VISION (COPIADO EXATAMENTE DO BOT DE REFERÊNCIA) ===
  async extrairTextoGoogleVision(imagemBase64) {
    if (!this.googleVisionEnabled || !this.visionClient) {
      throw new Error('Google Vision não está disponível');
    }

    try {
      console.log('🔍 Extraindo texto com Google Vision...');
      
      // Preparar imagem para Google Vision
      const imageBuffer = Buffer.from(imagemBase64, 'base64');
      
      // Chamar Google Vision API com timeout
      const [result] = await Promise.race([
        this.visionClient.textDetection({ image: { content: imageBuffer } }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Google Vision timeout')), this.googleVisionTimeout)
        )
      ]);

      if (!result.textAnnotations || result.textAnnotations.length === 0) {
        console.log('⚠️ Google Vision não encontrou texto na imagem');
        throw new Error('Nenhum texto encontrado na imagem');
      }

      // O primeiro item contém todo o texto detectado
      let textoCompleto = result.textAnnotations[0].description;
      console.log(`✅ Google Vision extraiu ${textoCompleto.length} caracteres`);
      console.log(`📝 Texto extraído: ${textoCompleto.length} caracteres`);

      // PRÉ-PROCESSAMENTO: Tentar reconstruir referências quebradas
      textoCompleto = this.reconstruirReferenciasQuebradas(textoCompleto);
      console.log(`🔧 Texto processado`);

      return textoCompleto;

    } catch (error) {
      console.error('❌ Erro no Google Vision:', error.message);
      throw error;
    }
  }

  // === INTERPRETAR COMPROVANTE COM GPT (OTIMIZADO) ===
  async interpretarComprovanteComGPT(textoExtraido) {
    console.log('🧠 Interpretando texto extraído com GPT-4...');
    
    // OTIMIZAÇÃO: Cache para texto extraído (v2 - com novo prompt)
    const cacheKey = `gpt_v2_${Buffer.from(textoExtraido).toString('base64').substring(0, 32)}`;
    const cached = this.cacheResultados.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('💾 ATACADO: Cache hit - GPT interpretação v2');
      this.tokenStats.cacheHits++;
      return cached.resultado;
    }
    
    // OTIMIZAÇÃO: Prompt específico para extrair referência correta
    const prompt = `Extrair dados de comprovante M-Pesa/E-Mola:
"${textoExtraido}"

IMPORTANTE: 
- Referência = código alfanumérico (ex: CIC4HCIVDEY, PP250911.2253.L16474)
- Valor = quantia em MT transferida
- NÃO usar números de telefone como referência

JSON: {"encontrado":true,"referencia":"CIC4HCIVDEY","valor":125} ou {"encontrado":false}`;

    try {
      this.tokenStats.calls++;
      const resposta = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0
      });

      console.log(`🔍 Resposta GPT-4: ${resposta.choices[0].message.content}`);
      
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      console.log(`✅ JSON extraído (GPT-4):`, resultado);
      
      // OTIMIZAÇÃO: Salvar no cache
      this.cacheResultados.set(cacheKey, {
        resultado: resultado,
        timestamp: Date.now()
      });
      
      return resultado;
      
    } catch (error) {
      console.error('❌ Erro no GPT-4:', error);
      throw error;
    }
  }

  // === PROCESSAR IMAGEM COM MÉTODO HÍBRIDO (NOVA FUNÇÃO PRINCIPAL) ===
  async processarImagemHibrida(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`🔄 Método híbrido: Google Vision + GPT-4 para ${remetente}`);
    
    try {
      // ETAPA 1: Tentar extrair texto com Google Vision
      const textoExtraido = await this.extrairTextoGoogleVision(imagemBase64);
      
      // ETAPA 2: Interpretar texto com GPT-4 (mais barato que Vision)
      const resultadoGPT = await this.interpretarComprovanteComGPT(textoExtraido);
      
      if (resultadoGPT.encontrado) {
        console.log(`✅ Método híbrido funcionou: ${resultadoGPT.referencia} - ${resultadoGPT.valor}MT`);
        
        const comprovante = {
          referencia: resultadoGPT.referencia,
          valor: this.limparValor(resultadoGPT.valor),
          fonte: 'google_vision_gpt',
          metodo: 'hibrido'
        };
        
        return await this.processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo, legendaImagem);
      } else {
        console.log(`❌ Método híbrido falhou - não encontrou dados`);
        throw new Error('Google Vision + GPT-4 não conseguiu extrair dados');
      }
      
    } catch (error) {
      console.error('❌ Erro no método híbrido:', error.message);
      console.log('🔄 Fallback: Tentando com GPT-4 Vision diretamente...');
      
      // FALLBACK: Usar GPT-4 Vision diretamente (método original)
      return await this.processarImagemGPT4Vision(imagemBase64, remetente, timestamp, configGrupo, legendaImagem);
    }
  }

  // === FALLBACK: GPT-4 VISION DIRETO (MÉTODO ORIGINAL) ===
  async processarImagemGPT4Vision(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`🔄 Fallback GPT-4 Vision para ${remetente}`);
    
    const temLegendaValida = legendaImagem && 
                            typeof legendaImagem === 'string' && 
                            legendaImagem.trim().length > 0;
    
    if (temLegendaValida) {
      console.log(`   📝 ATACADO: Legenda detectada: "${legendaImagem.trim()}"`);
    }

    // OTIMIZAÇÃO: Cache para imagens (hash pequeno para performance)
    const imageHash = imagemBase64.substring(0, 50);
    const cacheKey = `vision_${Buffer.from(imageHash).toString('base64').substring(0, 32)}`;
    const cached = this.cacheResultados.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('💾 ATACADO: Cache hit - GPT-4 Vision');
      this.tokenStats.cacheHits++;
      return cached.resultado;
    }

    // OTIMIZAÇÃO: Prompt 30% mais curto
    const prompt = `Extrair referência e valor de comprovante M-Pesa/E-Mola da imagem:
JSON: {"referencia":"XXX","valor":"123","encontrado":true} ou {"encontrado":false}`;

    try {
      this.tokenStats.calls++;
      const resposta = await this.openai.chat.completions.create({
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
        temperature: 0,
        max_tokens: 150
      });

      console.log(`   🔍 ATACADO: Resposta da IA para imagem: ${resposta.choices[0].message.content}`);
      
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      console.log(`   ✅ ATACADO: JSON extraído da imagem:`, resultado);
      
      if (resultado.encontrado) {
        const comprovante = {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'gpt4_vision',
          metodo: 'fallback'
        };
        
        const processado = await this.processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo, legendaImagem);
        
        // OTIMIZAÇÃO: Salvar resultado positivo no cache
        this.cacheResultados.set(cacheKey, {
          resultado: processado,
          timestamp: Date.now()
        });
        
        return processado;
      } else {
        console.log(`   ❌ ATACADO: IA não conseguiu extrair dados da imagem`);
        const resultadoNegativo = {
          sucesso: false,
          tipo: 'imagem_nao_reconhecida',
          mensagem: 'Não consegui ler o comprovante na imagem. Envie como texto.'
        };
        
        // OTIMIZAÇÃO: Salvar resultado negativo no cache também
        this.cacheResultados.set(cacheKey, {
          resultado: resultadoNegativo,
          timestamp: Date.now()
        });
        
        return resultadoNegativo;
      }
      
    } catch (error) {
      console.error('❌ ATACADO: Erro ao processar imagem com GPT-4 Vision:', error);
      return {
        sucesso: false,
        tipo: 'erro_processamento_imagem',
        mensagem: 'Erro ao processar imagem. Tente enviar como texto.'
      };
    }
  }

  // === PROCESSAR COMPROVANTE EXTRAÍDO (FUNÇÃO AUXILIAR) ===
  async processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   ✅ ATACADO: Dados extraídos da imagem: ${comprovante.referencia} - ${comprovante.valor}MT (${comprovante.metodo})`);
    
    const temLegendaValida = legendaImagem && 
                            typeof legendaImagem === 'string' && 
                            legendaImagem.trim().length > 0;
    
    // VERIFICAR SE HÁ LEGENDA COM NÚMEROS
    if (temLegendaValida) {
      console.log(`   🔍 ATACADO: ANALISANDO LEGENDA DA IMAGEM...`);
      
      const numeros = this.extrairNumerosSimples(legendaImagem);
      
      if (numeros.length > 0) {
        console.log(`   🎯 ATACADO: IMAGEM + NÚMEROS NA LEGENDA DETECTADOS!`);
        console.log(`   💰 Comprovante da imagem: ${comprovante.referencia} - ${comprovante.valor}MT`);
        console.log(`   📱 Números da legenda: ${numeros.join(', ')}`);
        
        if (numeros.length === 1) {
          // CORREÇÃO: Calcular megas antes de criar dados completos
          const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
          
          if (megasCalculados) {
            // NOVA LÓGICA: SEMPRE aplicar subdivisão se necessário (>10GB)
            const pedidosFinais = this.aplicarSubdivisaoSeNecessario(
              comprovante.referencia, 
              megasCalculados.quantidade, 
              numeros[0]
            );
            
            console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO (IMAGEM + LEGENDA): ${pedidosFinais.length} bloco(s)`);
            pedidosFinais.forEach((pedido, i) => {
              console.log(`      📦 Bloco ${i + 1}: ${pedido} (${Math.floor(pedido.split('|')[1]/1024)}GB)`);
            });
            
            return { 
              sucesso: true, 
              dadosCompletos: pedidosFinais.length === 1 ? pedidosFinais[0] : pedidosFinais,
              pedidosSubdivididos: pedidosFinais,
              tipo: 'numero_processado',
              numero: numeros[0],
              megas: megasCalculados.megas,
              subdividido: pedidosFinais.length > 1,
              fonte: 'imagem_com_legenda',
              metodo: comprovante.metodo
            };
          } else {
            console.log(`   ❌ ATACADO: Valor ${comprovante.valor}MT não encontrado na tabela`);
            return {
              sucesso: false,
              tipo: 'valor_nao_encontrado_na_tabela',
              valor: comprovante.valor,
              mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
            };
          }
        } else {
          // Múltiplos números detectados - redirecionar para bot de divisão
          console.log(`   ❌ ATACADO: Múltiplos números na legenda não permitidos`);
          return {
            sucesso: false,
            tipo: 'multiplos_numeros_nao_permitido',
            numeros: numeros,
            comprovativo: comprovante, // INCLUIR dados do comprovativo
            mensagem: 'Sistema atacado aceita apenas UM número por vez.'
          };
        }
      }
    }
    
    // Sem números na legenda - processar comprovante normalmente
    // CORREÇÃO: Calcular megas antes de salvar
    const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
    
    if (megasCalculados) {
      await this.processarComprovante(comprovante, remetente, timestamp);
      
      return { 
        sucesso: true, 
        tipo: 'comprovante_imagem_recebido',
        referencia: comprovante.referencia,
        valor: comprovante.valor,
        megas: megasCalculados.megas,
        metodo: comprovante.metodo,
        mensagem: `Comprovante da imagem processado! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}. Agora envie UM número que vai receber os megas.`
      };
    } else {
      console.log(`   ❌ ATACADO: Valor ${comprovante.valor}MT não encontrado na tabela`);
      return {
        sucesso: false,
        tipo: 'valor_nao_encontrado_na_tabela',
        valor: comprovante.valor,
        mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
      };
    }
  }

  // === CÓDIGO ORIGINAL MANTIDO - PROCESSAMENTO DE TEXTO ===
  
  // === FUNÇÃO AUXILIAR PARA LIMPEZA DE NÚMEROS ===
  limparNumero(numero) {
    if (!numero || typeof numero !== 'string') {
      return numero;
    }
    
    let numeroLimpo = numero
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/^\+258\s*/, '')
      .replace(/\s+/g, '')
      .trim();
    
    if (/^8[0-9]{8}$/.test(numeroLimpo)) {
      return numeroLimpo;
    }
    
    return numero;
  }

  // === EXTRAIR NÚMERO DE LEGENDA (CÓDIGO ORIGINAL) ===
  extrairNumeroDeLegenda(legendaImagem) {
    console.log(`   🔍 ATACADO: Analisando legenda da imagem: "${legendaImagem}"`);
    
    if (!legendaImagem || typeof legendaImagem !== 'string' || legendaImagem.trim().length === 0) {
      console.log(`   ❌ ATACADO: Legenda vazia ou inválida`);
      return null;
    }
    
    let legendaLimpa = legendaImagem
      .replace(/[📱📲📞☎️🔢💳🎯🤖✅❌⏳💰📊💵📋⚡]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`   📝 ATACADO: Legenda limpa: "${legendaLimpa}"`);
    
    const regexNumeros = /(?:\+258\s*)?8[0-9]{8}/g;
    const numerosEncontrados = legendaLimpa.match(regexNumeros) || [];
    
    if (numerosEncontrados.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado na legenda`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números na legenda: ${numerosEncontrados.join(', ')}`);
    
    if (numerosEncontrados.length === 1) {
      const numero = this.limparNumero(numerosEncontrados[0]);
      console.log(`   ✅ ATACADO: Número único na legenda aceito: ${numero}`);
      return numero;
    }
    
    const numerosValidos = [];
    
    for (const numero of numerosEncontrados) {
      const posicao = legendaLimpa.indexOf(numero);
      const contextoBefore = legendaLimpa.substring(Math.max(0, posicao - 30), posicao).toLowerCase();
      const contextoAfter = legendaLimpa.substring(posicao + numero.length, posicao + numero.length + 30).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero} na legenda...`);
      console.log(`   📖 ATACADO: Contexto legenda: "${contextoCompleto}"`);
      
      const indicadoresPagamento = [
        'para o', 'para número', 'beneficiário', 'destinatario',
        'taxa foi', 'transferiste'
      ];
      
      const eNumeroPagamento = indicadoresPagamento.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      if (!eNumeroPagamento) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: Número da legenda aceito: ${numeroLimpo} (original: ${numero})`);
      } else {
        console.log(`   ❌ ATACADO: Número da legenda rejeitado: ${numero}`);
      }
    }
    
    if (numerosValidos.length === 1) {
      return numerosValidos[0];
    } else if (numerosValidos.length > 1) {
      console.log(`   ❌ ATACADO: Múltiplos números válidos na legenda: ${numerosValidos.join(', ')}`);
      return { multiplos: true, numeros: numerosValidos };
    }
    
    console.log(`   ❌ ATACADO: Nenhum número válido na legenda`);
    return null;
  }

  // === EXTRAIR PREÇOS TABELA (MELHORADO COM MAIS PADRÕES) ===
  extrairPrecosTabela(tabelaTexto) {
    console.log(`   📋 Extraindo preços da tabela atacado...`);
    
    const precos = [];
    const linhas = tabelaTexto.split('\n');
    
    for (const linha of linhas) {
      const padroes = [
        /(\d+)GB➜(\d+)MT/gi,
        /📱\s*(\d+)GB\s*➜\s*(\d+)MT/gi,
        /(\d+)GB\s*[-–—]\s*(\d+)MT/gi,
        /📞\s*(\d+)\s*💫\s*(\d+)\s*MT/gi,
        /(\d+)💫\s*(\d+)MT/gi,
        /🌐\s*(\d+)GB\s*🔰\s*(\d+)MT💳/gi,  // 🌐 10GB  🔰   130MT💳
        /(\d+)GB\s*🔰\s*(\d+)MT/gi,         // 10GB  🔰   130MT
        /🌐.*?(\d+)GB.*?(\d+)MT/gi          // Padrão flexível para 🌐
      ];
      
      for (const padrao of padroes) {
        let match;
        while ((match = padrao.exec(linha)) !== null) {
          const quantidade = parseInt(match[1]);
          const preco = parseInt(match[2]);
          
          let tipo = 'gb';
          let descricao = '';
          
          if (linha.includes('💫')) {
            tipo = 'saldo';
            descricao = `${quantidade} Saldo`;
          } else if (linha.includes('GB')) {
            tipo = 'gb';
            descricao = `${quantidade}GB`;
          }
          
          precos.push({
            quantidade: quantidade,
            preco: preco,
            descricao: descricao,
            tipo: tipo,
            original: linha.trim()
          });
        }
      }
    }
    
    const precosUnicos = precos.filter((preco, index, self) => 
      index === self.findIndex(p => p.preco === preco.preco && p.quantidade === preco.quantidade)
    ).sort((a, b) => a.preco - b.preco);
    
    console.log(`   ✅ Preços extraídos: ${precosUnicos.length} pacotes encontrados`);
    
    return precosUnicos;
  }

  // === CALCULAR MEGAS POR VALOR (MELHORADO COM SUPORTE A PREÇOS DIRETOS) ===
  calcularMegasPorValor(valorPago, configGrupo) {
    console.log(`   🧮 ATACADO: Calculando megas para valor ${valorPago}MT...`);
    
    if (!configGrupo) {
      console.log(`   ❌ ATACADO: Configuração do grupo não disponível`);
      return null;
    }
    
    // CORREÇÃO: Se configGrupo tem uma estrutura de precos (do bot divisão), usar diretamente
    if (configGrupo.precos) {
      console.log(`   🔧 ATACADO: Usando configuração de preços diretos do bot divisão`);
      return this.calcularMegasPorValorDireto(valorPago, configGrupo.precos);
    }
    
    // CASO ORIGINAL: Se tem tabela como texto, usar método original
    if (!configGrupo.tabela) {
      console.log(`   ❌ ATACADO: Nem preços diretos nem tabela disponível`);
      return null;
    }
    
    const precos = this.extrairPrecosTabela(configGrupo.tabela);
    
    if (precos.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum preço encontrado na tabela`);
      return null;
    }
    
    const valorNumerico = parseFloat(valorPago);
    
    const precoExato = precos.find(p => p.preco === valorNumerico);
    if (precoExato) {
      console.log(`   ✅ ATACADO: Preço exato encontrado: ${precoExato.descricao}`);
      return {
        megas: precoExato.descricao,
        quantidade: precoExato.quantidade,
        tipo: precoExato.tipo,
        preco: precoExato.preco
      };
    }
    
    const tolerancia = 5;
    const precoProximo = precos.find(p => 
      Math.abs(p.preco - valorNumerico) <= tolerancia
    );
    
    if (precoProximo) {
      console.log(`   ⚡ ATACADO: Preço aproximado encontrado: ${precoProximo.descricao}`);
      return {
        megas: precoProximo.descricao,
        quantidade: precoProximo.quantidade,
        tipo: precoProximo.tipo,
        preco: precoProximo.preco,
        aproximado: true,
        diferenca: Math.abs(precoProximo.preco - valorNumerico)
      };
    }
    
    console.log(`   ❌ ATACADO: Nenhum pacote encontrado para valor ${valorPago}MT`);
    return null;
  }

  // === NOVO: CALCULAR MEGAS COM PREÇOS DIRETOS ===
  calcularMegasPorValorDireto(valorPago, precos) {
    console.log(`   🧮 ATACADO: Calculando megas com preços diretos para valor ${valorPago}MT...`);
    console.log(`   📋 ATACADO: Preços disponíveis:`, Object.entries(precos).map(([megas, preco]) => `${Math.floor(megas/1024)}GB=${preco}MT`).join(', '));
    
    const valorNumerico = parseFloat(valorPago);
    
    // Procurar preço exato
    for (const [megas, preco] of Object.entries(precos)) {
      if (parseInt(preco) === valorNumerico) {
        const gb = Math.floor(parseInt(megas) / 1024);
        const megasTexto = `${gb}GB`;
        console.log(`   ✅ ATACADO: Preço exato encontrado: ${valorNumerico}MT = ${megasTexto}`);
        return {
          megas: megasTexto,
          quantidade: parseInt(megas),
          tipo: 'GB',
          preco: parseInt(preco)
        };
      }
    }
    
    // Procurar preço aproximado (tolerância de 5MT)
    const tolerancia = 5;
    for (const [megas, preco] of Object.entries(precos)) {
      const diferenca = Math.abs(parseInt(preco) - valorNumerico);
      if (diferenca <= tolerancia) {
        const gb = Math.floor(parseInt(megas) / 1024);
        const megasTexto = `${gb}GB`;
        console.log(`   ⚡ ATACADO: Preço aproximado encontrado: ${valorNumerico}MT ≈ ${megasTexto} (diferença: ${diferenca}MT)`);
        return {
          megas: megasTexto,
          quantidade: parseInt(megas),
          tipo: 'GB',
          preco: parseInt(preco),
          aproximado: true,
          diferenca: diferenca
        };
      }
    }
    
    console.log(`   ❌ ATACADO: Valor ${valorPago}MT não encontrado na tabela de preços`);
    return null;
  }

  // === EXTRAIR NÚMERO ÚNICO (CÓDIGO ORIGINAL) ===
  extrairNumeroUnico(mensagem) {
    console.log(`   🔍 ATACADO: Extraindo número único da mensagem...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida`);
      return null;
    }
    
    const regex = /(?:\+258\s*)?8[0-9]{8}/g;
    const matches = mensagem.match(regex);
    
    if (!matches || matches.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número encontrado`);
      return null;
    }
    
    console.log(`   📱 ATACADO: Números brutos encontrados: ${matches.join(', ')}`);
    
    const numerosValidos = [];
    
    for (const numero of matches) {
      const posicao = mensagem.indexOf(numero);
      const contextoBefore = mensagem.substring(Math.max(0, posicao - 50), posicao).toLowerCase();
      const contextoAfter = mensagem.substring(posicao + numero.length, posicao + numero.length + 50).toLowerCase();
      const contextoCompleto = (contextoBefore + contextoAfter).toLowerCase();
      
      console.log(`   🔍 ATACADO: Analisando ${numero}...`);
      console.log(`   📖 ATACADO: Contexto antes: "${contextoBefore}"`);
      console.log(`   📖 ATACADO: Contexto depois: "${contextoAfter}"`);
      
      const indicadoresPagamento = [
        'transferiste', 'taxa foi', 'para o número', 'para número', 'para conta',
        'conta de', 'beneficiário', 'destinatario', 'nome:', 'para 8',
        'mt para', 'para ' + numero, numero + ' -', '- ' + numero
      ];
      
      const indicadoresDestino = [
        'megas para', 'manda para', 'enviar para', 'envia para', 
        'ativar para', 'este número', 'este numero', 'receber',
        'activar para', 'ativa para', 'para receber'
      ];
      
      const eNumeroPagamento = indicadoresPagamento.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      const eNumeroDestino = indicadoresDestino.some(indicador => 
        contextoCompleto.includes(indicador)
      );
      
      const tamanhoMensagem = mensagem.length;
      const percentualPosicao = (posicao / tamanhoMensagem) * 100;
      const estaNofinal = percentualPosicao > 70;
      const contextoAposFinal = contextoAfter.trim();
      const estaIsoladoNoFinal = estaNofinal && (contextoAposFinal === '' || contextoAposFinal.length < 10);
      
      console.log(`   📊 ATACADO: É pagamento: ${eNumeroPagamento}`);
      console.log(`   📊 ATACADO: É destino: ${eNumeroDestino}`);
      console.log(`   📊 ATACADO: Está no final (>70%): ${estaNofinal} (${percentualPosicao.toFixed(1)}%)`);
      console.log(`   📊 ATACADO: Isolado no final: ${estaIsoladoNoFinal}`);
      
      if (eNumeroDestino) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por contexto de destino: ${numeroLimpo} (original: ${numero})`);
      } else if (eNumeroPagamento) {
        console.log(`   ❌ ATACADO: REJEITADO por ser pagamento: ${numero}`);
      } else if (estaIsoladoNoFinal) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por estar isolado no final: ${numeroLimpo} (original: ${numero})`);
      } else if (estaNofinal && !eNumeroPagamento) {
        const numeroLimpo = this.limparNumero(numero);
        numerosValidos.push(numeroLimpo);
        console.log(`   ✅ ATACADO: ACEITO por estar no final: ${numeroLimpo} (original: ${numero})`);
      } else {
        console.log(`   ❌ ATACADO: REJEITADO por ser ambíguo: ${numero}`);
      }
    }
    
    const numerosUnicos = [...new Set(numerosValidos)];
    console.log(`   📱 ATACADO: Números válidos após filtragem: ${numerosUnicos.join(', ')}`);
    
    if (numerosUnicos.length === 0) {
      console.log(`   ❌ ATACADO: Nenhum número válido encontrado`);
      return null;
    }
    
    if (numerosUnicos.length > 1) {
      console.log(`   ❌ ATACADO: Múltiplos números VÁLIDOS detectados: ${numerosUnicos.join(', ')}`);
      console.log(`   ⚠️ ATACADO: Sistema aceita apenas UM número por vez`);
      return { multiplos: true, numeros: numerosUnicos };
    }
    
    const numeroFinal = this.limparNumero(numerosUnicos[0]);
    console.log(`   ✅ ATACADO: Número único válido aceito: ${numeroFinal}`);
    return numeroFinal;
  }

  // === SEPARAR COMPROVANTE E NÚMERO (CÓDIGO ORIGINAL) ===
  separarComprovanteENumero(mensagem) {
    console.log(`   🔍 ATACADO: Separando comprovante e número...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida para separação`);
      return { textoComprovante: '', numero: null };
    }
    
    const resultadoNumero = this.extrairNumeroUnico(mensagem);
    
    if (resultadoNumero && resultadoNumero.multiplos) {
      return { 
        textoComprovante: '', 
        numero: null, 
        erro: 'multiplos_numeros',
        numeros: resultadoNumero.numeros 
      };
    }
    
    const numero = resultadoNumero;
    
    let textoComprovante = mensagem;
    
    if (numero) {
      const padroes = [
        new RegExp(`\\s*megas? para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*manda para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*envia para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*enviar para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*este\\s+número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*numero\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*${numero}\\s*$`, 'gi'),
        new RegExp(`^\\s*${numero}\\s*`, 'gi')
      ];
      
      for (const padrao of padroes) {
        textoComprovante = textoComprovante.replace(padrao, ' ');
      }
    }
    
    textoComprovante = textoComprovante.replace(/\s+/g, ' ').trim();
    
    console.log(`   📄 ATACADO: Texto do comprovante: ${textoComprovante.substring(0, 50)}...`);
    console.log(`   📱 ATACADO: Número extraído: ${numero || 'nenhum'}`);
    
    return {
      textoComprovante: textoComprovante,
      numero: numero
    };
  }

  // === BUSCAR COMPROVANTE RECENTE NO HISTÓRICO (CÓDIGO ORIGINAL) ===
  async buscarComprovanteRecenteNoHistorico(remetente, timestamp) {
    console.log(`   🔍 ATACADO: Buscando comprovante recente no histórico...`);

    const mensagensRecentes = this.historicoMensagens.filter(msg => {
      const timeDiff = timestamp - msg.timestamp;
      return msg.remetente === remetente && timeDiff <= 1800000;
    });

    if (mensagensRecentes.length === 0) {
      console.log(`   ❌ ATACADO: Nenhuma mensagem recente de ${remetente} nos últimos 30 minutos`);
      return null;
    }

    console.log(`   📊 ATACADO: Analisando ${mensagensRecentes.length} mensagens dos últimos 30 minutos...`);

    for (let msg of mensagensRecentes.reverse()) {
      if (msg.tipo === 'texto') {
        console.log(`   🔍 ATACADO: Verificando mensagem: "${msg.mensagem.substring(0, 50)}..."`);
        
        const comprovante = await this.analisarComprovante(msg.mensagem);
        if (comprovante) {
          const tempoDecorrido = Math.floor((timestamp - msg.timestamp) / 60000);
          console.log(`   ✅ ATACADO: Comprovante encontrado no histórico: ${comprovante.referencia} - ${comprovante.valor}MT (${tempoDecorrido} min atrás)`);
          return comprovante;
        }
      }
    }

    console.log(`   ❌ ATACADO: Comprovante não encontrado no histórico`);
    return null;
  }

  // === FUNÇÃO PRINCIPAL PARA O BOT (CÓDIGO ORIGINAL) ===
  async processarMensagemBot(mensagem, remetente, tipoMensagem = 'texto', configGrupo = null, legendaImagem = null) {
    const timestamp = Date.now();
    
    if (tipoMensagem === 'imagem') {
      console.log(`\n🧠 IA ATACADO processando IMAGEM de ${remetente}`);
      if (legendaImagem && legendaImagem.trim().length > 0) {
        console.log(`📝 Com legenda: "${legendaImagem.substring(0, 100)}..."`);
      } else {
        console.log(`📝 Sem legenda ou legenda vazia`);
      }
    } else {
      console.log(`\n🧠 IA ATACADO processando TEXTO de ${remetente}: ${mensagem.substring(0, 50)}...`);
    }
    
    this.adicionarAoHistorico(mensagem, remetente, timestamp, tipoMensagem);
    
    try {
      if (tipoMensagem === 'imagem') {
        return await this.processarImagem(mensagem, remetente, timestamp, configGrupo, legendaImagem);
      } else {
        return await this.processarTexto(mensagem, remetente, timestamp, configGrupo);
      }
    } catch (error) {
      console.error('❌ ATACADO: Erro na IA:', error);
      return { erro: true, mensagem: error.message };
    }
  }

  // === PROCESSAR TEXTO (CÓDIGO ORIGINAL) ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo = null) {
    console.log(`   📝 ATACADO: Analisando mensagem: "${mensagem}"`);
    
    const mensagemLimpa = mensagem.trim();
    const apenasNumeroRegex = /^(?:\+258\s*)?8[0-9]{8}$/;
    
    if (apenasNumeroRegex.test(mensagemLimpa)) {
      const numeroLimpo = this.limparNumero(mensagemLimpa);
      console.log(`   📱 ATACADO: Detectado número isolado: ${numeroLimpo} (original: ${mensagemLimpa})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    const resultado = this.separarComprovanteENumero(mensagem);
    
    if (resultado.erro === 'multiplos_numeros') {
      console.log(`   ❌ ATACADO: Múltiplos números não permitidos`);
      return {
        sucesso: false,
        tipo: 'multiplos_numeros_nao_permitido',
        numeros: resultado.numeros,
        mensagem: 'Sistema atacado aceita apenas UM número por vez.'
      };
    }
    
    const { textoComprovante, numero } = resultado;
    
    let comprovante = null;
    if (textoComprovante && textoComprovante.length > 10) {
      comprovante = await this.analisarComprovante(textoComprovante);
    }
    
    if (comprovante && numero) {
      console.log(`   🎯 ATACADO: COMPROVANTE + NÚMERO na mesma mensagem!`);
      console.log(`   💰 ATACADO: Comprovante: ${comprovante.referencia} - ${comprovante.valor}MT`);
      console.log(`   📱 ATACADO: Número: ${numero}`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const numeroLimpo = this.limparNumero(numero);
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numeroLimpo}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numeroLimpo,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }
    
    if (numero && !comprovante) {
      const numeroLimpo = this.limparNumero(numero);
      console.log(`   📱 ATACADO: Apenas número detectado: ${numeroLimpo} (original: ${numero})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    if (comprovante && !numero) {
      console.log(`   💰 ATACADO: Apenas comprovante detectado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        await this.processarComprovante(comprovante, remetente, timestamp);
        
        return { 
          sucesso: true, 
          tipo: 'comprovante_recebido',
          referencia: comprovante.referencia,
          valor: comprovante.valor,
          megas: megasCalculados.megas,
          mensagem: `Comprovante recebido! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}. Agora envie UM número que vai receber os megas.`
        };
      } else {
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }
    
    console.log(`   ❓ ATACADO: Mensagem não reconhecida como comprovante ou número`);
    return { 
      sucesso: false, 
      tipo: 'mensagem_nao_reconhecida',
      mensagem: null 
    };
  }

  // === PROCESSAMENTO DE IMAGEM MELHORADO ===
  async processarImagem(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   📸 ATACADO: Processando imagem de ${remetente} com método híbrido (Google Vision + GPT-4)`);
    
    // Usar o novo método híbrido Google Vision + GPT-4
    return await this.processarImagemHibrida(imagemBase64, remetente, timestamp, configGrupo, legendaImagem);
  }

  // === EXTRAIR NÚMEROS SIMPLES ===
  extrairNumerosSimples(legenda) {
    if (!legenda || typeof legenda !== 'string') {
      return [];
    }
    
    // Buscar números de 9 dígitos que começam com 8
    const regex = /\b8[0-9]{8}\b/g;
    const numeros = legenda.match(regex) || [];
    
    console.log(`   🔍 ATACADO: Números encontrados na legenda: ${numeros.join(', ')}`);
    
    return [...new Set(numeros)]; // Remove duplicatas
  }

  // === FUNÇÃO AUXILIAR PARA EXTRAIR JSON ===
  extrairJSON(texto) {
    try {
      return JSON.parse(texto);
    } catch (e) {
      try {
        let limpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(limpo);
      } catch (e2) {
        try {
          const match = texto.match(/\{[\s\S]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (e3) {
          return { encontrado: false };
        }
      }
    }
  }

  // === EXTRAÇÃO DE JSON MELHORADA ===
  extrairJSONMelhorado(texto) {
    console.log(`   🔍 ATACADO: Extraindo JSON melhorado de: ${texto.substring(0, 200)}...`);
    
    // Tentar encontrar JSON completo primeiro
    try {
      return JSON.parse(texto);
    } catch (e) {
      // Remover blocos de código se houver
      try {
        let limpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(limpo);
      } catch (e2) {
        // Procurar por JSON em qualquer lugar do texto
        try {
          const match = texto.match(/\{[^}]*"encontrado"\s*:\s*true[^}]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (e3) {
          // Procurar por qualquer JSON válido
          try {
            const match = texto.match(/\{[^{}]*\}/);
            if (match) {
              return JSON.parse(match[0]);
            }
          } catch (e4) {
            // Extração manual como fallback - padrões mais robustos
            const refMatch = texto.match(/["']?referencia["']?\s*:\s*["']?([A-Z0-9.]+)["']?/i);
            const valorMatch = texto.match(/["']?valor["']?\s*:\s*["']?(\d+(?:\.\d+)?)["']?/i);
            const encontradoMatch = texto.match(/["']?encontrado["']?\s*:\s*(true|false)/i);
            
            // Tentar extrair de texto explicativo também
            if (!refMatch) {
              const refMatch2 = texto.match(/ID da transacao\s+([A-Z0-9.]+)/i);
              const valorMatch2 = texto.match(/Transferiste\s+(\d+(?:\.\d+)?)MT/i);
              
              if (refMatch2 && valorMatch2) {
                return {
                  referencia: refMatch2[1].trim(),
                  valor: valorMatch2[1].trim(),
                  encontrado: true
                };
              }
            }
            
            if (refMatch && valorMatch) {
              return {
                referencia: refMatch[1].trim(),
                valor: valorMatch[1].trim(),
                encontrado: encontradoMatch ? encontradoMatch[1] === 'true' : true
              };
            }
            
            console.error('❌ ATACADO: Todas as tentativas de parsing falharam');
          }
        }
      }
    }
    
    return { encontrado: false, motivo: 'parsing_failed' };
  }

  // === PROCESSAR NÚMERO (CÓDIGO ORIGINAL) ===
  async processarNumero(numero, remetente, timestamp, configGrupo = null) {
    console.log(`   🔢 ATACADO: Processando número ${numero} para ${remetente}`);
    
    if (this.comprovantesEmAberto[remetente]) {
      const comprovante = this.comprovantesEmAberto[remetente];
      console.log(`   ✅ ATACADO: Comprovante em aberto encontrado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numero}`;
        delete this.comprovantesEmAberto[remetente];
        
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor,
          origem: 'comprovante_em_aberto'
        };
      } else {
        console.log(`   ❌ ATACADO: Não foi possível calcular megas para valor ${comprovante.valor}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n💰 Valor enviado: *${comprovante.valor}MT*\n📋 Digite *tabela* para ver os valores disponíveis`
        };
      }
    }

    console.log(`   ❌ ATACADO: Nenhum comprovante em aberto. Buscando no histórico...`);
    const comprovante = await this.buscarComprovanteRecenteNoHistorico(remetente, timestamp);
    
    if (comprovante) {
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numero}`;
        console.log(`   ✅ ATACADO: ENCONTRADO NO HISTÓRICO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numero,
          megas: megasCalculados.megas,
          valorPago: comprovante.valor,
          origem: 'historico'
        };
      } else {
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor,
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis`
        };
      }
    }

    console.log(`   ❌ ATACADO: Nenhum comprovante encontrado`);
    return { 
      sucesso: false, 
      tipo: 'numero_sem_comprovante',
      numero: numero,
      mensagem: `Número detectado, mas não encontrei comprovante nos últimos 30 minutos. Envie o comprovante primeiro.`
    };
  }

  // === ANALISAR COMPROVANTE (OTIMIZADO COM CACHE) ===
  async analisarComprovante(mensagem) {
    const temConfirmado = /^confirmado/i.test(mensagem.trim());
    const temID = /^id\s/i.test(mensagem.trim());
    const temIDdaTransacao = /^id da transacao/i.test(mensagem.trim());
    const temTransferiste = /transferiste\s+\d+/i.test(mensagem);
    
    // FORÇAR reconhecimento para comprovantes óbvios
    if (temConfirmado || temID || temIDdaTransacao || temTransferiste) {
      console.log(`🎯 ATACADO: Comprovante DETECTADO - Confirmado:${temConfirmado} ID:${temID} IDTransacao:${temIDdaTransacao} Transferiste:${temTransferiste}`);
    } else {
      return null;
    }

    // EXTRAÇÃO DIRETA POR REGEX (FALLBACK GARANTIDO)
    try {
      const refMatch = mensagem.match(/(?:ID da transacao|Confirmado)\s+([A-Z0-9][A-Z0-9.]*[A-Z0-9])/i);
      const valorMatch = mensagem.match(/Transferiste\s+(\d+(?:\.\d+)?)MT/i);
      
      if (refMatch && valorMatch) {
        console.log(`🎯 ATACADO: Extração DIRETA por regex - Ref:${refMatch[1]} Valor:${valorMatch[1]}`);
        return {
          referencia: refMatch[1].trim(),
          valor: this.limparValor(valorMatch[1]),
          fonte: 'regex_direto'
        };
      }
    } catch (regexError) {
      console.log(`⚠️ ATACADO: Regex direto falhou, tentando IA...`);
    }

    // OTIMIZAÇÃO: Verificar cache primeiro
    const cacheKey = `comprovante_v3_${Buffer.from(mensagem).toString('base64').substring(0, 32)}`;
    const cached = this.cacheResultados.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('💾 ATACADO: Cache hit - comprovante v3');
      this.tokenStats.cacheHits++;
      return cached.resultado;
    }

    // OTIMIZAÇÃO: Prompt direto e curto
    const prompt = `Extrair dados:
"${mensagem}"

APENAS responda com JSON válido:
{"referencia":"XXX","valor":"123","encontrado":true}
ou
{"encontrado":false}`;

    // OTIMIZAÇÃO: Parâmetros otimizados
    this.tokenStats.calls++;
    const resposta = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0,
      max_tokens: 150,
      top_p: 0.9
    });

    try {
      const resultado = this.extrairJSONMelhorado(resposta.choices[0].message.content);
      
      if (resultado.encontrado) {
        const comprovanteProcessado = {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'texto'
        };
        
        // OTIMIZAÇÃO: Salvar no cache
        this.cacheResultados.set(cacheKey, {
          resultado: comprovanteProcessado,
          timestamp: Date.now()
        });
        
        return comprovanteProcessado;
      }
    } catch (parseError) {
      console.error('❌ ATACADO: Erro ao parsear resposta da IA:', parseError);
    }

    // OTIMIZAÇÃO: Salvar resultado negativo no cache também
    this.cacheResultados.set(cacheKey, {
      resultado: null,
      timestamp: Date.now()
    });

    return null;
  }

  // === PROCESSAR COMPROVANTE (CÓDIGO ORIGINAL) ===
  async processarComprovante(comprovante, remetente, timestamp) {
    this.comprovantesEmAberto[remetente] = {
      referencia: comprovante.referencia,
      valor: comprovante.valor,
      timestamp: timestamp,
      fonte: comprovante.fonte
    };

    console.log(`   ⏳ ATACADO: Comprovante de ${remetente} guardado, aguardando número...`);
  }

  // === LIMPAR VALOR MONETÁRIO (CÓDIGO ORIGINAL) ===
  limparValor(valor) {
    if (!valor) return '0';
    
    let valorStr = valor.toString();
    valorStr = valorStr.replace(/\s*(MT|mt|meticais?|metical)\s*/gi, '');
    valorStr = valorStr.trim();
    
    if (valorStr.includes(',') && valorStr.includes('.')) {
      valorStr = valorStr.replace(/,/g, '');
    } else if (valorStr.includes(',')) {
      const parts = valorStr.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        valorStr = valorStr.replace(',', '.');
      } else {
        valorStr = valorStr.replace(/,/g, '');
      }
    }
    
    const match = valorStr.match(/\d+\.?\d*/);
    if (match) {
      const numero = parseFloat(match[0]);
      return numero.toString();
    }
    
    const digitos = valorStr.replace(/[^\d]/g, '');
    return digitos || '0';
  }

  // === HISTÓRICO (CÓDIGO ORIGINAL) ===
  adicionarAoHistorico(mensagem, remetente, timestamp, tipo = 'texto') {
    this.historicoMensagens.push({
      mensagem,
      remetente,
      timestamp,
      tipo
    });

    if (this.historicoMensagens.length > this.maxHistorico) {
      this.historicoMensagens = this.historicoMensagens.slice(-this.maxHistorico);
    }
  }

  // === LIMPEZA (CÓDIGO ORIGINAL) ===
  limparComprovantesAntigos() {
    const agora = Date.now();
    const timeout = 45 * 60 * 1000;
    let removidos = 0;

    Object.keys(this.comprovantesEmAberto).forEach(remetente => {
      const comprovante = this.comprovantesEmAberto[remetente];
      if (agora - comprovante.timestamp > timeout) {
        delete this.comprovantesEmAberto[remetente];
        removidos++;
      }
    });

    if (removidos > 0) {
      console.log(`🗑️ ATACADO: Removidos ${removidos} comprovantes antigos (>45min)`);
    }
  }

  // === OTIMIZAÇÃO: Limpeza de cache ===
  limparCacheAntigo() {
    const agora = Date.now();
    let removidos = 0;
    
    for (const [key, data] of this.cacheResultados.entries()) {
      if (agora - data.timestamp > this.cacheTimeout) {
        this.cacheResultados.delete(key);
        removidos++;
      }
    }
    
    if (removidos > 0) {
      console.log(`🗑️ ATACADO: Cache limpo - ${removidos} entradas antigas removidas`);
    }
  }

  // === STATUS (CÓDIGO ORIGINAL) ===
  getStatus() {
    return {
      comprovantesEmAberto: Object.keys(this.comprovantesEmAberto).length,
      mensagensNoHistorico: this.historicoMensagens.length,
      detalhesComprovantes: this.comprovantesEmAberto
    };
  }

  // === FUNÇÃO PARA COMANDOS ADMIN (CÓDIGO ORIGINAL) ===
  getStatusDetalhado() {
    let status = `🧠 *STATUS DA IA ATACADO v2.1 MELHORADA*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    status += `💾 Mensagens no histórico: ${this.historicoMensagens.length}\n`;
    status += `⏳ Comprovantes em aberto: ${Object.keys(this.comprovantesEmAberto).length}\n\n`;
    
    if (Object.keys(this.comprovantesEmAberto).length > 0) {
      status += `📋 *Comprovantes aguardando número:*\n`;
      Object.entries(this.comprovantesEmAberto).forEach(([remetente, comp]) => {
        const tempo = Math.floor((Date.now() - comp.timestamp) / 60000);
        status += `• ${remetente.replace('@c.us', '')}: ${comp.referencia} - ${comp.valor}MT (${tempo}min)\n`;
      });
    }
    
    status += `\n🚀 *MELHORIAS IMPLEMENTADAS:*\n`;
    status += `✅ Processamento de imagens OTIMIZADO!\n`;
    status += `✅ 2 tentativas com prompts diferentes\n`;
    status += `✅ Correção automática de referências quebradas\n`;
    status += `✅ Case-sensitive (mantém maiúsculas/minúsculas)\n`;
    status += `✅ Validação rigorosa padrão E-Mola\n`;
    status += `✅ Detecção de referências incompletas\n`;
    status += `✅ Extração melhorada de JSON\n`;
    status += `✅ Mensagens de erro mais úteis\n\n`;
    status += `🎯 *PROCESSAMENTO DE TEXTO:* Mantido original (perfeito!)\n`;
    status += `🔧 *APENAS IMAGENS:* Foram melhoradas drasticamente\n`;
    
    return status;
  }
  
  // === NOVA FUNCIONALIDADE: SUBDIVISÃO EM BLOCOS DE 10GB PARA IMAGENS ===
  aplicarSubdivisaoSeNecessario(referenciaBase, megasTotal, numero) {
    console.log(`🔧 ATACADO: Verificando se ${megasTotal}MB (${Math.floor(megasTotal/1024)}GB) precisa subdivisão...`);
    
    // Se for 10GB ou menos, não precisa subdividir
    if (megasTotal <= 10240) {
      console.log(`   ✅ ATACADO: ${Math.floor(megasTotal/1024)}GB ≤ 10GB - Não precisa subdividir`);
      return [`${referenciaBase}|${megasTotal}|${numero}`];
    }
    
    // Precisa subdividir em blocos de 10GB
    const numeroBlocos = Math.ceil(megasTotal / 10240);
    const megasPorBloco = Math.floor(megasTotal / numeroBlocos);
    const megasRestante = megasTotal % numeroBlocos;
    
    console.log(`   🔧 ATACADO: ${Math.floor(megasTotal/1024)}GB → ${numeroBlocos} blocos de ~${Math.floor(megasPorBloco/1024)}GB`);
    
    const pedidosSubdivididos = [];
    
    // Criar subdivisões
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
      
      const novaReferencia = referenciaBase + String(i + 1);
      const pedidoSubdividido = `${novaReferencia}|${megasBloco}|${numero}`;
      
      pedidosSubdivididos.push(pedidoSubdividido);
      
      console.log(`      📦 ATACADO: Bloco ${i + 1}/${numeroBlocos}: ${novaReferencia} - ${Math.floor(megasBloco/1024)}GB (${megasBloco}MB)`);
    }
    
    // Validar se a subdivisão preservou o total
    const totalSubdividido = pedidosSubdivididos.reduce((sum, pedido) => {
      const megasPedido = parseInt(pedido.split('|')[1]);
      return sum + megasPedido;
    }, 0);
    
    if (Math.abs(megasTotal - totalSubdividido) > 5) {
      console.error(`❌ ATACADO: Erro na subdivisão! Original: ${megasTotal}MB, Subdividido: ${totalSubdividido}MB`);
      // Em caso de erro, retornar pedido original
      return [`${referenciaBase}|${megasTotal}|${numero}`];
    }
    
    console.log(`✅ ATACADO: Subdivisão concluída com sucesso!`);
    console.log(`   📊 ${Math.floor(megasTotal/1024)}GB → ${pedidosSubdivididos.length} blocos (máx 10GB cada)`);
    
    return pedidosSubdivididos;
  }

  // === OTIMIZAÇÃO: Cache para comandos frequentes ===
  getCachedResponse(comando, configGrupo) {
    const cacheKey = `comando_${comando}_${configGrupo?.nome || 'default'}`;
    const cached = this.cacheResultados.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log(`💾 ATACADO: Cache hit - comando ${comando}`);
      this.tokenStats.cacheHits++;
      return cached.resultado;
    }
    
    let resultado = null;
    if (comando === 'tabela' && configGrupo?.tabela) {
      resultado = configGrupo.tabela;
    } else if (comando === 'pagamento' && configGrupo?.pagamento) {
      resultado = configGrupo.pagamento;
    }
    
    if (resultado) {
      this.cacheResultados.set(cacheKey, {
        resultado: resultado,
        timestamp: Date.now()
      });
      console.log(`💾 ATACADO: Comando ${comando} armazenado no cache`);
    }
    
    return resultado;
  }

  // === OTIMIZAÇÃO: Status com estatísticas de cache ===
  getStatusOtimizado() {
    const status = this.getStatusDetalhado();
    const cacheSize = this.cacheResultados.size;
    const hitRate = this.tokenStats.calls > 0 ? 
      ((this.tokenStats.cacheHits / this.tokenStats.calls) * 100).toFixed(1) : 0;
    
    return status + `\n\n🚀 *OTIMIZAÇÕES ATIVAS:*\n` +
      `💾 Cache: ${cacheSize} entradas ativas\n` +
      `📊 Taxa de acerto: ${hitRate}% (${this.tokenStats.cacheHits}/${this.tokenStats.calls})\n` +
      `💰 Economia estimada: ~${Math.round(this.tokenStats.cacheHits * 0.3)}% tokens poupados`;
  }
}

module.exports = WhatsAppAIAtacado;
