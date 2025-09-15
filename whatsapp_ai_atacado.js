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

    // MÉTRICAS DE PROCESSAMENTO DE IMAGENS ROBUSTAS
    this.imagemStats = {
      total: 0,
      sucessos: 0,
      falhas: 0,
      metodos: {
        hibrido_direto: 0,
        abordagem_alternativa: 0,
        regex_direto: 0,
        prompt_simplificado: 0,
        gpt4_vision_fallback: 0
      },
      referencias_reconstruidas: 0,
      referencias_validadas: 0,
      referencias_rejeitadas: 0
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
    
    // INICIALIZAR SISTEMA DE CONTROLE DE REFERÊNCIAS
    this.referencias_processadas = new Map();
    
    setInterval(() => {
      this.limparComprovantesAntigos();
      this.limparCacheAntigo(); // OTIMIZAÇÃO: Limpar cache junto
      this.limparReferenciasAntigas(); // NOVO: Limpar referências antigas
    }, 10 * 60 * 1000);
    
    const visionStatus = this.googleVisionEnabled ? 'Google Vision + GPT-4' : 'GPT-4 Vision';
    console.log(`🧠 IA WhatsApp ATACADO v5.0 inicializada - ${visionStatus}`);
  }

  // === RECONSTRUIR REFERÊNCIAS QUEBRADAS (VERSÃO MELHORADA E ROBUSTA) ===
  reconstruirReferenciasQuebradas(texto) {
    console.log('🔧 Reconstruindo referências quebradas - VERSÃO ROBUSTA...');
    console.log(`📝 Texto original (${texto.length} chars): ${texto.substring(0, 200)}...`);
    
    // Padrões EXPANDIDOS de referências M-Pesa/E-Mola quebradas
    const padroes = [
      // === PADRÕES E-MOLA (PP + AAMMDD + . + HHMM + . + Letra + 5 Números) ===
      // Padrão completo: PP250914.1134.T38273
      // PP250914.1134.T + 38273 = PP250914.1134.T38273
      {
        regex: /(PP\d{6}\.\d{4}\.[A-Za-z])\s*\n?\s*(\d{5})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [Letra+5Digitos]: "${p1}" + "${p2}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: letra + 5 dígitos'
      },
      // CASOS ESPECÍFICOS DE QUEBRA E-MOLA (NOVOS)
      // PP250914.1134.T3827 + 3 = PP250914.1134.T38273 (1 dígito faltando)
      {
        regex: /(PP\d{6}\.\d{4}\.[A-Za-z]\d{4})\s*\n?\s*(\d{1})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [1Digito]: "${p1}" + "${p2}" = "${resultado}"`);
          // Validar se tem exatamente 19 caracteres
          if (resultado.length === 19 && /^PP\d{6}\.\d{4}\.[A-Za-z]\d{5}$/.test(resultado)) {
            console.log(`✅ E-Mola [1Digito]: VÁLIDO`);
            return resultado;
          }
          console.log(`❌ E-Mola [1Digito]: INVÁLIDO (${resultado.length} chars)`);
          return match;
        },
        tipo: 'E-Mola: 1 dígito final'
      },
      // PP250914.1134.T382 + 73 = PP250914.1134.T38273 (2 dígitos faltando)
      {
        regex: /(PP\d{6}\.\d{4}\.[A-Za-z]\d{3})\s*\n?\s*(\d{2})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [2Digitos]: "${p1}" + "${p2}" = "${resultado}"`);
          if (resultado.length === 19 && /^PP\d{6}\.\d{4}\.[A-Za-z]\d{5}$/.test(resultado)) {
            console.log(`✅ E-Mola [2Digitos]: VÁLIDO`);
            return resultado;
          }
          console.log(`❌ E-Mola [2Digitos]: INVÁLIDO`);
          return match;
        },
        tipo: 'E-Mola: 2 dígitos finais'
      },
      // PP250914.1134.T38 + 273 = PP250914.1134.T38273 (3 dígitos faltando)
      {
        regex: /(PP\d{6}\.\d{4}\.[A-Za-z]\d{2})\s*\n?\s*(\d{3})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [3Digitos]: "${p1}" + "${p2}" = "${resultado}"`);
          if (resultado.length === 19 && /^PP\d{6}\.\d{4}\.[A-Za-z]\d{5}$/.test(resultado)) {
            console.log(`✅ E-Mola [3Digitos]: VÁLIDO`);
            return resultado;
          }
          console.log(`❌ E-Mola [3Digitos]: INVÁLIDO`);
          return match;
        },
        tipo: 'E-Mola: 3 dígitos finais'
      },
      // PP250914.1134. + T38273 = PP250914.1134.T38273
      {
        regex: /(PP\d{6}\.\d{4}\.)\s*\n?\s*([A-Za-z]\d{5})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [SemLetra]: "${p1}" + "${p2}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: sem letra inicial'
      },
      // PP250914. + 1134.T38273 = PP250914.1134.T38273
      {
        regex: /(PP\d{6}\.)\s*\n?\s*(\d{4}\.[A-Za-z]\d{5})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [SemHora]: "${p1}" + "${p2}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: sem hora'
      },
      // PP + 250914.1134.T38273 = PP250914.1134.T38273
      {
        regex: /(PP)\s*\n?\s*(\d{6}\.\d{4}\.[A-Za-z]\d{5})/gi,
        reconstruct: (match, p1, p2) => {
          const resultado = `${p1}${p2}`;
          console.log(`🔧 E-Mola [SemPrefixo]: "${p1}" + "${p2}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: sem prefixo'
      },
      // Quebra em 3 partes: PP250914 + 1134 + T38273
      {
        regex: /(PP\d{6})\s*\n?\s*(\d{4})\s*\n?\s*([A-Za-z]\d{5})/gi,
        reconstruct: (match, p1, p2, p3) => {
          const resultado = `${p1}.${p2}.${p3}`;
          console.log(`🔧 E-Mola [Tripla]: "${p1}" + "${p2}" + "${p3}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: tripla quebra'
      },
      // Quebra em 4 partes: PP + 250914 + 1134 + T38273
      {
        regex: /(PP)\s*\n?\s*(\d{6})\s*\n?\s*(\d{4})\s*\n?\s*([A-Za-z]\d{5})/gi,
        reconstruct: (match, p1, p2, p3, p4) => {
          const resultado = `${p1}${p2}.${p3}.${p4}`;
          console.log(`🔧 E-Mola [Quádrupla]: "${p1}" + "${p2}" + "${p3}" + "${p4}" = "${resultado}"`);
          return resultado;
        },
        tipo: 'E-Mola: quádrupla quebra'
      },
      
      // === PADRÕES M-PESA (11 caracteres alfanuméricos misturados) ===
      // CASO ESPECÍFICO: 10 chars + 1 char = 11 chars total (mais comum)
      {
        regex: /([A-Z0-9]{10})\s*\n?\s*([A-Z0-9]{1})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2) => {
          const total = p1 + p2;
          console.log(`🔍 M-Pesa 10+1: "${p1}" + "${p2}" = "${total}" (${total.length} chars)`);
          // Validar se totaliza exatamente 11 caracteres
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            console.log(`✅ M-Pesa 10+1 VALIDADO: ${total}`);
            return total;
          }
          console.log(`❌ M-Pesa 10+1 INVÁLIDO: ${total} (${total.length} chars)`);
          return match;
        },
        tipo: 'M-Pesa 10+1 chars'
      },
      // CASO ESPECÍFICO: 9 chars + 2 chars = 11 chars total
      {
        regex: /([A-Z0-9]{9})\s*\n?\s*([A-Z0-9]{2})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2) => {
          const total = p1 + p2;
          console.log(`🔍 M-Pesa 9+2: "${p1}" + "${p2}" = "${total}" (${total.length} chars)`);
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            console.log(`✅ M-Pesa 9+2 VALIDADO: ${total}`);
            return total;
          }
          console.log(`❌ M-Pesa 9+2 INVÁLIDO: ${total} (${total.length} chars)`);
          return match;
        },
        tipo: 'M-Pesa 9+2 chars'
      },
      // Quebra simples: 8 chars + 3 chars = 11 chars total
      {
        regex: /([A-Z0-9]{6,8})\s*\n?\s*([A-Z0-9]{3,5})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2) => {
          const total = p1 + p2;
          console.log(`🔍 M-Pesa 6-8+3-5: "${p1}" + "${p2}" = "${total}" (${total.length} chars)`);
          // Validar se totaliza 11 caracteres
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            console.log(`✅ M-Pesa 11 chars VALIDADO: ${total}`);
            return total;
          }
          console.log(`❌ M-Pesa 11 chars INVÁLIDO: ${total} (${total.length} chars)`);
          return match;
        },
        tipo: 'M-Pesa 11 chars'
      },
      // Quebra 7+4: CHMOH4H + ICK2 = CHMOH4HICK2 (exemplo de 11 chars)
      {
        regex: /([A-Z0-9]{7})\s*\n?\s*([A-Z0-9]{4})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2) => {
          const total = p1 + p2;
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            return total;
          }
          return match;
        },
        tipo: 'M-Pesa 7+4'
      },
      // Quebra 5+6: CH4OH + 4HICK2 = CH4OH4HICK2
      {
        regex: /([A-Z0-9]{5})\s*\n?\s*([A-Z0-9]{6})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2) => {
          const total = p1 + p2;
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            return total;
          }
          return match;
        },
        tipo: 'M-Pesa 5+6'
      },
      // Quebra em 3 partes: CHM + OH4H + ICK2 = CHMOH4HICK2
      {
        regex: /([A-Z0-9]{3})\s*\n?\s*([A-Z0-9]{4})\s*\n?\s*([A-Z0-9]{4})(?=\s|$|\n|\.)/gi,
        reconstruct: (match, p1, p2, p3) => {
          const total = p1 + p2 + p3;
          if (total.length === 11 && /^[A-Z0-9]+$/.test(total) && /[A-Z]/.test(total) && /[0-9]/.test(total)) {
            return total;
          }
          return match;
        },
        tipo: 'M-Pesa tripla 3+4+4'
      },
      
      // === PADRÕES GENÉRICOS MAIS ROBUSTOS ===
      // Código longo + sufixo curto
      {
        regex: /([A-Z]{6,12})\s*\n?\s*([A-Z0-9]{1,4})(?=\s|$|\n)/gi,
        reconstruct: (match, p1, p2) => {
          const comprimentoTotal = p1.length + p2.length;
          // M-Pesa típico: 8-15 caracteres
          if (comprimentoTotal >= 8 && comprimentoTotal <= 15 && /^[A-Z]/.test(p1)) {
            return `${p1}${p2}`;
          }
          return match;
        },
        tipo: 'Genérico'
      },
      // Código médio + sufixo médio
      {
        regex: /([A-Z0-9]{4,8})\s*\n?\s*([A-Z0-9]{3,6})(?=\s|$|\n)/gi,
        reconstruct: (match, p1, p2) => {
          const comprimentoTotal = p1.length + p2.length;
          // Verificar se não são números de telefone ou valores
          if (comprimentoTotal >= 8 && comprimentoTotal <= 15 && 
              !/^\d+$/.test(p1) && !/^\d+$/.test(p2) && 
              /^[A-Z]/.test(p1)) {
            return `${p1}${p2}`;
          }
          return match;
        },
        tipo: 'Genérico'
      },
      
      // === LIMPEZA DE PREFIXOS ===
      // Confirmado + CÓDIGO = CÓDIGO
      {
        regex: /(?:Confirmado|ID da transacao|Transacao|Ref\.?)\s*:?\s*\n?\s*([A-Z0-9]{8,15})/gi,
        reconstruct: (match, p1) => p1,
        tipo: 'Limpeza'
      },
      
      // === PADRÕES DE MÚLTIPLAS QUEBRAS ===
      // Código quebrado em 3 partes: ABC + DEF + 123
      {
        regex: /([A-Z]{3,6})\s*\n?\s*([A-Z]{2,4})\s*\n?\s*([A-Z0-9]{2,4})/gi,
        reconstruct: (match, p1, p2, p3) => {
          const comprimentoTotal = p1.length + p2.length + p3.length;
          if (comprimentoTotal >= 8 && comprimentoTotal <= 15) {
            return `${p1}${p2}${p3}`;
          }
          return match;
        },
        tipo: 'Tripla quebra'
      }
    ];

    let textoProcessado = texto;
    let alteracoes = 0;

    // PRIMEIRA PASSADA: Aplicar todos os padrões
    for (const padrao of padroes) {
      const matches = [...textoProcessado.matchAll(padrao.regex)];
      for (const match of matches) {
        const original = match[0];
        
        let reconstruido;
        if (match.length === 2) {
          reconstruido = padrao.reconstruct(match[0], match[1]);
        } else if (match.length === 3) {
          reconstruido = padrao.reconstruct(match[0], match[1], match[2]);
        } else if (match.length === 4) {
          reconstruido = padrao.reconstruct(match[0], match[1], match[2], match[3]);
        }
        
        if (reconstruido !== original && reconstruido !== match[0]) {
          textoProcessado = textoProcessado.replace(original, reconstruido);
          console.log(`   🔧 [${padrao.tipo}] "${original.replace(/\n/g, '\\n')}" → "${reconstruido}"`);
          alteracoes++;
        }
      }
    }

    // SEGUNDA PASSADA: Detectar referências órfãs e tentar conectar
    const referenciasOrfas = this.detectarReferenciasOrfas(textoProcessado);
    if (referenciasOrfas.length > 0) {
      console.log(`🔍 Detectadas ${referenciasOrfas.length} possíveis referências órfãs`);
      const textoComOrfas = this.conectarReferenciasOrfas(textoProcessado, referenciasOrfas);
      if (textoComOrfas !== textoProcessado) {
        textoProcessado = textoComOrfas;
        alteracoes++;
        console.log(`   🔗 Referências órfãs conectadas`);
      }
    }

    if (alteracoes > 0) {
      console.log(`✅ ${alteracoes} referência(s) reconstruída(s)`);
      console.log(`📝 Texto processado: ${textoProcessado.substring(0, 200)}...`);
      
      // MÉTRICAS: Referências reconstruídas
      this.imagemStats.referencias_reconstruidas += alteracoes;
    } else {
      console.log(`ℹ️ Nenhuma referência quebrada detectada`);
    }

    return textoProcessado;
  }

  // === DETECTAR REFERÊNCIAS ÓRFÃS ===
  detectarReferenciasOrfas(texto) {
    const linhas = texto.split('\n');
    const orfas = [];
    
    for (let i = 0; i < linhas.length - 1; i++) {
      const linhaAtual = linhas[i].trim();
      const proximaLinha = linhas[i + 1].trim();
      
      // Detectar possível início de referência seguido de continuação
      if (/^[A-Z]{3,8}$/.test(linhaAtual) && /^[A-Z0-9]{2,6}$/.test(proximaLinha)) {
        orfas.push({
          linha1: linhaAtual,
          linha2: proximaLinha,
          posicao: i
        });
      }
    }
    
    return orfas;
  }

  // === CONECTAR REFERÊNCIAS ÓRFÃS ===
  conectarReferenciasOrfas(texto, orfas) {
    let textoProcessado = texto;
    
    for (const orfa of orfas) {
      const padrao = new RegExp(`${orfa.linha1}\\s*\\n\\s*${orfa.linha2}`, 'g');
      const reconstruida = `${orfa.linha1}${orfa.linha2}`;
      
      // Verificar se o comprimento faz sentido para uma referência
      if (reconstruida.length >= 8 && reconstruida.length <= 15) {
        textoProcessado = textoProcessado.replace(padrao, reconstruida);
        console.log(`   🔗 Órfã conectada: "${orfa.linha1}\\n${orfa.linha2}" → "${reconstruida}"`);
      }
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
      console.log(`📝 Texto bruto extraído:\n"${textoCompleto}"`);

      // === VALIDAR COMPLETUDE ANTES DA RECONSTRUÇÃO ===
      console.log(`🔍 Verificando completude das referências...`);
      const completude = this.validarCompletude(textoCompleto);
      
      if (!completude.completo && completude.fragmentosSuspeitos.length > 0) {
        console.log(`⚠️ REFERÊNCIAS POSSIVELMENTE INCOMPLETAS DETECTADAS! Iniciando reconstrução forçada...`);
      } else if (completude.completo) {
        console.log(`✅ Referências aparentemente completas encontradas (${completude.referenciasCompletas})`);
      }

      // PRÉ-PROCESSAMENTO: Tentar reconstruir referências quebradas
      console.log(`🔧 Iniciando reconstrução de referências quebradas...`);
      textoCompleto = this.reconstruirReferenciasQuebradas(textoCompleto);
      console.log(`✅ Reconstrução concluída`);
      
      // === VALIDAR COMPLETUDE APÓS A RECONSTRUÇÃO ===
      console.log(`🔍 Verificando completude após reconstrução...`);
      const completudeFinal = this.validarCompletude(textoCompleto);
      
      if (completudeFinal.completo) {
        console.log(`✅ SUCESSO: ${completudeFinal.referenciasCompletas} referência(s) completa(s) após reconstrução`);
      } else {
        console.log(`⚠️ ATENÇÃO: Ainda há fragmentos suspeitos após reconstrução`);
        if (completudeFinal.fragmentosSuspeitos.length > 0) {
          console.log(`📋 Fragmentos ainda suspeitos: ${completudeFinal.fragmentosSuspeitos.map(f => f.fragmento).join(', ')}`);
        }
      }

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
    
    // PROMPT MELHORADO: Com especificações exatas dos padrões
    const prompt = `Analisa este texto extraído de comprovante M-Pesa/E-Mola de Moçambique:

"${textoExtraido}"

PADRÕES OFICIAIS DE REFERÊNCIAS:

📱 **E-MOLA**: PP + [AAMMDD] + "." + [HHMM] + "." + [Letra + 5 números]
   • Exemplo: PP250914.1134.T38273
   • PP = prefixo fixo
   • 250914 = data (14/09/2025)
   • 1134 = hora (11:34)
   • T38273 = código (letra + 5 números)

📱 **M-PESA**: Exatamente 11 caracteres alfanuméricos misturados
   • Exemplo: CHMOH4HICK2
   • Contém letras e números misturados
   • Total: 11 caracteres

INSTRUÇÕES CRÍTICAS:
1. A referência pode estar QUEBRADA em múltiplas linhas
2. Reconstrói juntando as partes quebradas
3. NÃO usar números de telefone (258..., 84..., 85...)
4. VALOR em MT (Meticais): "125.00MT", "125MT", etc.

EXEMPLOS DE RECONSTRUÇÃO:
• "PP250914.1134.T" + "38273" = "PP250914.1134.T38273"
• "CHMOH4H" + "ICK2" = "CHMOH4HICK2"
• "PP250914" + "1134" + "T38273" = "PP250914.1134.T38273"

RESPOSTA JSON:
{"encontrado": true, "referencia": "PP250914.1134.T38273", "valor": "125.00"}
ou 
{"encontrado": false}

Analisa TODO o texto e reconstrói a referência completa:`;

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
      
      // VALIDAÇÃO RIGOROSA: Verificar se a referência extraída é válida
      if (resultado.encontrado) {
        const validacao = this.validarReferenciaMozambique(resultado.referencia, resultado.valor);
        if (!validacao.valida) {
          console.log(`❌ Validação falhou: ${validacao.motivo}`);
          console.log(`📝 Referência rejeitada: "${resultado.referencia}"`);
          
          // MÉTRICAS: Referência rejeitada
          this.imagemStats.referencias_rejeitadas++;
          
          // Tentar extrair referência alternativa do texto original
          const referenciaAlternativa = this.buscarReferenciaAlternativa(textoExtraido);
          if (referenciaAlternativa) {
            console.log(`🔄 Usando referência alternativa: "${referenciaAlternativa}"`);
            resultado.referencia = referenciaAlternativa;
            this.imagemStats.referencias_validadas++;
          } else {
            console.log(`❌ Nenhuma referência válida encontrada`);
            resultado.encontrado = false;
          }
        } else {
          console.log(`✅ Referência validada: ${resultado.referencia} (${validacao.tipo})`);
          // MÉTRICAS: Referência validada
          this.imagemStats.referencias_validadas++;
        }
      }
      
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

  // === GERAR HASH ÚNICO DA IMAGEM ===
  gerarHashImagem(imagemBase64) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(imagemBase64);
    const hashCompleto = hash.digest('hex');
    const hashCurto = hashCompleto.substring(0, 16); // 16 caracteres únicos
    return {
      completo: hashCompleto,
      curto: hashCurto,
      timestamp: Date.now()
    };
  }

  // === VERIFICAR SE IMAGEM JÁ FOI PROCESSADA ===
  verificarImagemDuplicada(hashImagem) {
    // Verificar se essa imagem já foi processada recentemente (últimas 2 horas)
    const timeout = 2 * 60 * 60 * 1000; // 2 horas
    const agora = Date.now();
    
    if (!this.imagensProcessadas) {
      this.imagensProcessadas = new Map();
    }
    
    // Limpar imagens antigas
    for (const [hash, dados] of this.imagensProcessadas.entries()) {
      if (agora - dados.timestamp > timeout) {
        this.imagensProcessadas.delete(hash);
      }
    }
    
    // Verificar se esta imagem específica já foi processada
    const imagemExistente = this.imagensProcessadas.get(hashImagem.curto);
    if (imagemExistente) {
      console.log(`⚠️ DUPLICATA DETECTADA: Imagem já processada há ${Math.floor((agora - imagemExistente.timestamp) / 60000)} minutos`);
      console.log(`🔍 Hash: ${hashImagem.curto}`);
      console.log(`📋 Resultado anterior: ${imagemExistente.referencia} - ${imagemExistente.valor}MT`);
      return {
        isDuplicata: true,
        dadosAnteriores: imagemExistente
      };
    }
    
    return { isDuplicata: false };
  }

  // === REGISTRAR IMAGEM PROCESSADA ===
  registrarImagemProcessada(hashImagem, resultado) {
    if (!this.imagensProcessadas) {
      this.imagensProcessadas = new Map();
    }
    
    this.imagensProcessadas.set(hashImagem.curto, {
      timestamp: hashImagem.timestamp,
      hash: hashImagem.curto,
      referencia: resultado.referencia || 'N/A',
      valor: resultado.valor || 'N/A',
      remetente: resultado.remetente || 'N/A',
      sucesso: resultado.sucesso || false
    });
    
    console.log(`📝 IMAGEM REGISTRADA: ${hashImagem.curto} - ${resultado.referencia || 'N/A'}`);
  }

  // === PROCESSAR IMAGEM COM MÉTODO HÍBRIDO ROBUSTO (VERSÃO MELHORADA + ANTI-DUPLICAÇÃO) ===
  async processarImagemHibrida(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`🔄 MÉTODO HÍBRIDO ROBUSTO: Google Vision + GPT-4 para ${remetente}`);
    
    // === SISTEMA ANTI-DUPLICAÇÃO ===
    const hashImagem = this.gerarHashImagem(imagemBase64);
    console.log(`🔍 Hash da imagem: ${hashImagem.curto}`);
    
    const verificacaoDuplicata = this.verificarImagemDuplicada(hashImagem);
    if (verificacaoDuplicata.isDuplicata) {
      const dadosAnteriores = verificacaoDuplicata.dadosAnteriores;
      return {
        sucesso: false,
        tipo: 'imagem_duplicada',
        hashImagem: hashImagem.curto,
        dadosAnteriores: dadosAnteriores,
        mensagem: `⚠️ *IMAGEM DUPLICADA*\n\n🔍 Esta imagem já foi processada anteriormente.\n\n📋 *Dados do processamento anterior:*\n• Referência: ${dadosAnteriores.referencia}\n• Valor: ${dadosAnteriores.valor}MT\n• Processado há: ${Math.floor((Date.now() - dadosAnteriores.timestamp) / 60000)} minutos\n\n💡 Se precisa reprocessar, envie uma nova captura de tela.`
      };
    }
    
    // MÉTRICAS: Incrementar contador total
    this.imagemStats.total++;
    
    try {
      // ETAPA 1: Extrair texto com Google Vision (com logs detalhados)
      console.log(`📷 Etapa 1/3: Extraindo texto da imagem...`);
      const textoExtraido = await this.extrairTextoGoogleVision(imagemBase64);
      console.log(`✅ Google Vision extraiu ${textoExtraido.length} caracteres`);
      
      // ETAPA 2: Interpretar texto com GPT-4 robusto
      console.log(`🧠 Etapa 2/3: Interpretando texto com GPT-4...`);
      const resultadoGPT = await this.interpretarComprovanteComGPT(textoExtraido);
      
      if (resultadoGPT.encontrado) {
        console.log(`✅ SUCESSO HÍBRIDO: ${resultadoGPT.referencia} - ${resultadoGPT.valor}MT`);
        console.log(`📊 Etapa 3/3: Processando comprovante extraído...`);
        
        // MÉTRICAS: Sucesso com método híbrido direto
        this.imagemStats.sucessos++;
        this.imagemStats.metodos.hibrido_direto++;
        
        const comprovante = {
          referencia: resultadoGPT.referencia,
          valor: this.limparValor(resultadoGPT.valor),
          fonte: 'google_vision_gpt_v2',
          metodo: 'hibrido_robusto',
          textoOriginal: textoExtraido.substring(0, 100) // Para debug
        };
        
        return await this.processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo, legendaImagem, hashImagem);
      } else {
        console.log(`❌ GPT-4 não encontrou dados no texto extraído`);
        console.log(`📝 Texto que foi analisado: "${textoExtraido.substring(0, 300)}..."`);
        
        // ETAPA 3: Tentar múltiplas abordagens de reconstrução
        console.log(`🔄 Etapa 3/3: Tentando abordagens alternativas...`);
        const resultadoAlternativo = await this.tentarAbordagensAlternativas(textoExtraido);
        
        if (resultadoAlternativo.encontrado) {
          console.log(`✅ SUCESSO COM ABORDAGEM ALTERNATIVA: ${resultadoAlternativo.referencia}`);
          
          // MÉTRICAS: Sucesso com abordagem alternativa
          this.imagemStats.sucessos++;
          this.imagemStats.metodos.abordagem_alternativa++;
          
          const comprovante = {
            referencia: resultadoAlternativo.referencia,
            valor: this.limparValor(resultadoAlternativo.valor),
            fonte: 'google_vision_gpt_alternativo',
            metodo: 'hibrido_alternativo'
          };
          
          return await this.processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo, legendaImagem, hashImagem);
        }
        
        throw new Error('Nenhuma abordagem conseguiu extrair dados da imagem');
      }
      
    } catch (error) {
      console.error(`❌ MÉTODO HÍBRIDO ROBUSTO FALHOU: ${error.message}`);
      console.log('🔄 Fallback: Tentando com GPT-4 Vision diretamente...');
      
      // MÉTRICAS: Tentar fallback
      this.imagemStats.metodos.gpt4_vision_fallback++;
      
      try {
        // FALLBACK: Usar GPT-4 Vision diretamente (método original)
        const resultado = await this.processarImagemGPT4Vision(imagemBase64, remetente, timestamp, configGrupo, legendaImagem);
        
        // Se chegou aqui, o fallback funcionou
        this.imagemStats.sucessos++;
        return resultado;
        
      } catch (fallbackError) {
        // MÉTRICAS: Falha completa
        this.imagemStats.falhas++;
        console.error(`❌ Fallback também falhou: ${fallbackError.message}`);
        throw fallbackError;
      }
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
  async processarComprovanteExtraido(comprovante, remetente, timestamp, configGrupo = null, legendaImagem = null, hashImagem = null) {
    console.log(`   ✅ ATACADO: Dados extraídos da imagem: ${comprovante.referencia} - ${comprovante.valor}MT (${comprovante.metodo})`);
    
    // ====== VALIDAÇÃO DE CONSISTÊNCIA ENTRE DADOS ======
    const textoCompleto = (comprovante.textoOriginal || '') + ' ' + (legendaImagem || '');
    const validacaoConsistencia = this.validarConsistenciaComprovante(
      comprovante.referencia, 
      comprovante.valor, 
      textoCompleto
    );
    
    if (!validacaoConsistencia.valida) {
      console.log(`❌ ATACADO: FALHA NA VALIDAÇÃO DE CONSISTÊNCIA - ${validacaoConsistencia.motivo}`);
      if (validacaoConsistencia.inconsistencias) {
        validacaoConsistencia.inconsistencias.forEach(inc => console.log(`   ⚠️ ${inc}`));
      }
      
      return {
        sucesso: false,
        tipo: 'dados_inconsistentes',
        inconsistencias: validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo],
        referencia: comprovante.referencia,
        valor: comprovante.valor,
        mensagem: `❌ *DADOS INCONSISTENTES DETECTADOS!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n⚠️ *PROBLEMAS:*\n${(validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo]).map(inc => `• ${inc}`).join('\n')}\n\n💡 Verifique o comprovante e tente novamente.`
      };
    }
    
    // REGISTRAR REFERÊNCIA COMO PROCESSADA
    if (this.referencias_processadas) {
      this.referencias_processadas.set(comprovante.referencia, Date.now());
    }
    
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
            
            // REGISTRAR IMAGEM COMO PROCESSADA COM SUCESSO
            if (hashImagem) {
              this.registrarImagemProcessada(hashImagem, {
                referencia: comprovante.referencia,
                valor: comprovante.valor,
                remetente: remetente,
                sucesso: true
              });
            }
            
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
      
      // REGISTRAR IMAGEM COMO PROCESSADA COM SUCESSO
      if (hashImagem) {
        this.registrarImagemProcessada(hashImagem, {
          referencia: comprovante.referencia,
          valor: comprovante.valor,
          remetente: remetente,
          sucesso: true
        });
      }
      
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

  // === CALCULAR MEGAS POR VALOR (VALIDAÇÃO RIGOROSA - SEM TOLERÂNCIA) ===
  calcularMegasPorValor(valorPago, configGrupo) {
    console.log(`   🧮 ATACADO: Calculando megas para valor ${valorPago}MT (VALIDAÇÃO RIGOROSA)...`);
    console.log(`   🔍 DEBUG: Tipo de valorPago: ${typeof valorPago}, Valor: "${valorPago}"`);

    if (!configGrupo) {
      console.log(`   ❌ ATACADO: Configuração do grupo não disponível`);
      return null;
    }

    // CORREÇÃO: Se configGrupo tem uma estrutura de precos (do bot divisão), usar diretamente
    if (configGrupo.precos) {
      console.log(`   🔧 ATACADO: Usando configuração de preços diretos do bot divisão`);
      console.log(`   🔍 DEBUG: Passando valorPago: "${valorPago}" para calcularMegasPorValorDireto`);
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
    
    // VALIDAÇÃO RIGOROSA: APENAS PREÇOS EXATOS - SEM TOLERÂNCIA
    const precoExato = precos.find(p => p.preco === valorNumerico);
    if (precoExato) {
      console.log(`   ✅ ATACADO: Preço EXATO encontrado na tabela: ${precoExato.descricao} = ${valorNumerico}MT`);
      return {
        megas: precoExato.descricao,
        quantidade: precoExato.quantidade,
        tipo: precoExato.tipo,
        preco: precoExato.preco
      };
    }
    
    // RIGOROSO: Se não encontrar valor exato, REJEITAR completamente
    console.log(`   ❌ ATACADO: Valor ${valorPago}MT NÃO ENCONTRADO na tabela - REJEITADO (validação rigorosa)`);
    console.log(`   📋 ATACADO: Valores válidos disponíveis: ${precos.map(p => `${p.preco}MT`).join(', ')}`);
    return null;
  }

  // === CALCULAR MEGAS COM PREÇOS DIRETOS (VALIDAÇÃO RIGOROSA - SEM TOLERÂNCIA) ===
  calcularMegasPorValorDireto(valorPago, precos) {
    console.log(`   🧮 ATACADO: Calculando megas com preços diretos para valor ${valorPago}MT (VALIDAÇÃO RIGOROSA)...`);
    console.log(`   🔍 DEBUG DIRETO: Tipo de valorPago: ${typeof valorPago}, Valor recebido: "${valorPago}"`);
    console.log(`   📋 ATACADO: Preços disponíveis:`, Object.entries(precos).map(([megas, preco]) => `${Math.floor(megas/1024)}GB=${preco}MT`).join(', '));

    const valorNumerico = parseFloat(valorPago);
    console.log(`   🔍 DEBUG DIRETO: valorNumerico após parseFloat: ${valorNumerico}`);
    
    // VALIDAÇÃO RIGOROSA: APENAS PREÇOS EXATOS - SEM TOLERÂNCIA
    for (const [megas, preco] of Object.entries(precos)) {
      if (parseInt(preco) === valorNumerico) {
        const gb = Math.floor(parseInt(megas) / 1024);
        const megasTexto = `${gb}GB`;
        console.log(`   ✅ ATACADO: Preço EXATO encontrado na tabela: ${valorNumerico}MT = ${megasTexto}`);
        return {
          megas: megasTexto,
          quantidade: parseInt(megas),
          tipo: 'GB',
          preco: parseInt(preco)
        };
      }
    }
    
    // RIGOROSO: Se não encontrar valor exato, REJEITAR completamente
    const valoresValidos = Object.values(precos).map(p => `${p}MT`).sort((a, b) => parseInt(a) - parseInt(b));
    console.log(`   ❌ ATACADO: Valor ${valorPago}MT NÃO ENCONTRADO na tabela - REJEITADO (validação rigorosa)`);
    console.log(`   📋 ATACADO: Valores válidos disponíveis: ${valoresValidos.join(', ')}`);
    return null;
  }

  // === VALIDAR VALOR CONTRA TABELA (VALIDAÇÃO RIGOROSA) ===
  validarValorContraTabela(valorPago, configGrupo) {
    console.log(`   🔍 VALIDAÇÃO RIGOROSA: Verificando se valor ${valorPago}MT está na tabela...`);
    
    if (!configGrupo) {
      console.log(`   ❌ VALIDAÇÃO: Configuração do grupo não disponível`);
      return {
        valido: false,
        motivo: 'Configuração do grupo não disponível',
        valoresValidos: []
      };
    }
    
    let valoresValidos = [];
    
    // Verificar se tem preços diretos (estrutura do bot divisão)
    if (configGrupo.precos) {
      valoresValidos = Object.values(configGrupo.precos).map(p => parseInt(p)).sort((a, b) => a - b);
    } else if (configGrupo.tabela) {
      // Extrair preços da tabela como texto
      const precos = this.extrairPrecosTabela(configGrupo.tabela);
      valoresValidos = precos.map(p => p.preco).sort((a, b) => a - b);
    } else {
      console.log(`   ❌ VALIDAÇÃO: Nem preços diretos nem tabela disponível`);
      return {
        valido: false,
        motivo: 'Tabela de preços não configurada',
        valoresValidos: []
      };
    }
    
    const valorNumerico = parseFloat(valorPago);
    const valorExiste = valoresValidos.includes(valorNumerico);
    
    if (valorExiste) {
      console.log(`   ✅ VALIDAÇÃO: Valor ${valorPago}MT APROVADO - encontrado na tabela`);
      return {
        valido: true,
        valor: valorNumerico,
        valoresValidos: valoresValidos
      };
    } else {
      console.log(`   ❌ VALIDAÇÃO: Valor ${valorPago}MT REJEITADO - NÃO encontrado na tabela`);
      console.log(`   📋 VALIDAÇÃO: Valores válidos: ${valoresValidos.map(v => `${v}MT`).join(', ')}`);
      return {
        valido: false,
        motivo: `Valor ${valorPago}MT não está na tabela de preços`,
        valorInvalido: valorNumerico,
        valoresValidos: valoresValidos
      };
    }
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
        
        const comprovante = await this.analisarComprovante(msg.mensagem, configGrupo);
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
    
    // FILTRO DE ECONOMIA: Ignorar apenas conversas óbvias, mas manter funcionalidade
    const eComprovanteObvio = /^(confirmado|id\s|id da transacao)/i.test(mensagemLimpa) || 
                              /transferiste\s+\d+/i.test(mensagemLimpa) ||
                              /^8[0-9]{8}$/.test(mensagemLimpa); // Número moçambicano
    
    const eComandoSistema = /(tabela|pagamento|teste|ajuda)/i.test(mensagemLimpa);
    
    const eConversaCasual = /^(bom dia|boa tarde|boa noite|olá|oi|como está|obrigad|muito obrigad)/i.test(mensagemLimpa) ||
                           /^(quanto custa|qual.*preço|como funciona)/i.test(mensagemLimpa);
    
    // APENAS ignorar conversas casuais óbvias
    if (!eComprovanteObvio && !eComandoSistema && eConversaCasual) {
      console.log(`💰 ATACADO: POUPANDO TOKENS - Conversa casual ignorada: "${mensagemLimpa.substring(0,30)}..."`);
      return { 
        sucesso: false, 
        tipo: 'conversa_casual_ignorada',
        mensagem: null 
      };
    }
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
      comprovante = await this.analisarComprovante(textoComprovante, configGrupo);
    }
    
    // VERIFICAR SE VALOR É INVÁLIDO (VALIDAÇÃO RIGOROSA)
    if (comprovante && comprovante.encontrado === false && comprovante.motivo === 'valor_nao_esta_na_tabela') {
      console.log(`   ❌ ATACADO: VALOR INVÁLIDO DETECTADO - ${comprovante.valor_invalido}MT`);
      return {
        sucesso: false,
        tipo: 'valor_nao_encontrado_na_tabela',
        valor: comprovante.valor_invalido,
        referencia: comprovante.referencia,
        mensagem: comprovante.mensagem_erro
      };
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
      // VERIFICAR SE VALOR É INVÁLIDO (VALIDAÇÃO RIGOROSA) - SEGUNDA VERIFICAÇÃO
      if (comprovante.encontrado === false && comprovante.motivo === 'valor_nao_esta_na_tabela') {
        console.log(`   ❌ ATACADO: VALOR INVÁLIDO DETECTADO (só comprovante) - ${comprovante.valor_invalido}MT`);
        return {
          sucesso: false,
          tipo: 'valor_nao_encontrado_na_tabela',
          valor: comprovante.valor_invalido,
          referencia: comprovante.referencia,
          mensagem: comprovante.mensagem_erro
        };
      }
      
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

  // === VALIDAR COMPLETUDE DE REFERÊNCIAS ===
  validarCompletude(texto) {
    console.log(`🔍 VALIDANDO COMPLETUDE: Verificando se referências estão completas...`);
    
    // Procurar por possíveis referências incompletas ou quebradas
    const fragmentosSuspeitos = [];
    
    // FRAGMENTOS M-PESA SUSPEITOS
    // Códigos de 10 caracteres alfanuméricos (pode estar faltando 1 char)
    const fragmentos10chars = texto.match(/\b[A-Z0-9]{10}\b/g);
    if (fragmentos10chars) {
      fragmentos10chars.forEach(frag => {
        if (/[A-Z]/.test(frag) && /[0-9]/.test(frag)) {
          fragmentosSuspeitos.push({
            fragmento: frag,
            tipo: 'M-Pesa_possivelmente_incompleto',
            caracteresFaltando: 1,
            comprimentoAtual: 10,
            comprimentoEsperado: 11
          });
        }
      });
    }
    
    // Códigos de 9 caracteres alfanuméricos (pode estar faltando 2 chars)
    const fragmentos9chars = texto.match(/\b[A-Z0-9]{9}\b/g);
    if (fragmentos9chars) {
      fragmentos9chars.forEach(frag => {
        if (/[A-Z]/.test(frag) && /[0-9]/.test(frag)) {
          fragmentosSuspeitos.push({
            fragmento: frag,
            tipo: 'M-Pesa_possivelmente_incompleto',
            caracteresFaltando: 2,
            comprimentoAtual: 9,
            comprimentoEsperado: 11
          });
        }
      });
    }
    
    // FRAGMENTOS E-MOLA SUSPEITOS
    // Padrões PP incompletos
    const emolaIncompletos = [
      // PP250914.1134.T3827 (falta 1 dígito)
      /\bPP\d{6}\.\d{4}\.[A-Za-z]\d{4}\b/g,
      // PP250914.1134. (falta letra + 5 dígitos)
      /\bPP\d{6}\.\d{4}\.\b/g,
      // PP250914. (falta tudo após a data)
      /\bPP\d{6}\.\b/g
    ];
    
    emolaIncompletos.forEach((regex, index) => {
      const matches = texto.match(regex);
      if (matches) {
        matches.forEach(match => {
          let faltando = '';
          if (index === 0) faltando = '1 dígito final';
          else if (index === 1) faltando = 'letra + 5 dígitos';
          else if (index === 2) faltando = 'hora + letra + 5 dígitos';
          
          fragmentosSuspeitos.push({
            fragmento: match,
            tipo: 'E-Mola_possivelmente_incompleto',
            faltando: faltando,
            comprimentoAtual: match.length,
            comprimentoEsperado: 19 // PP250914.1134.T38273 = 19 chars
          });
        });
      }
    });
    
    // PROCURAR POR CARACTERES ISOLADOS PRÓXIMOS
    if (fragmentosSuspeitos.length > 0) {
      console.log(`⚠️ COMPLETUDE: Encontrados ${fragmentosSuspeitos.length} fragmento(s) possivelmente incompleto(s):`);
      
      fragmentosSuspeitos.forEach((suspeito, index) => {
        console.log(`   ${index + 1}. ${suspeito.tipo}: "${suspeito.fragmento}" (${suspeito.comprimentoAtual}/${suspeito.comprimentoEsperado} chars)`);
        
        if (suspeito.tipo.includes('M-Pesa')) {
          // Procurar caracteres isolados próximos que possam completar
          const regexProximo = new RegExp(`${suspeito.fragmento}\\s*\\n?\\s*([A-Z0-9]{1,${suspeito.caracteresFaltando}})`, 'i');
          const proximoMatch = texto.match(regexProximo);
          
          if (proximoMatch) {
            console.log(`   🔍 POSSÍVEL COMPLEMENTO: "${proximoMatch[1]}" encontrado próximo`);
            console.log(`   💡 SUGESTÃO: "${suspeito.fragmento}" + "${proximoMatch[1]}" = "${suspeito.fragmento}${proximoMatch[1]}"`);
          }
        }
      });
      
      return {
        completo: false,
        fragmentosSuspeitos: fragmentosSuspeitos,
        requer_reconstrucao: true
      };
    }
    
    // Verificar se há referências aparentemente completas
    const referenciasMPesa = texto.match(/\b[A-Z0-9]{11}\b/g) || [];
    const referenciasEMola = texto.match(/\bPP\d{6}\.\d{4}\.[A-Za-z]\d{5}\b/g) || [];
    
    // Filtrar M-Pesa válidas (11 caracteres alfanuméricos com letras E números)
    const mPesaValidas = referenciasMPesa.filter(ref => 
      ref.length === 11 && 
      /^[A-Z0-9]+$/.test(ref) && 
      /[A-Z]/.test(ref) && 
      /[0-9]/.test(ref)
    );
    
    const referenciasCompletas = mPesaValidas.length + referenciasEMola.length;
    
    if (referenciasCompletas > 0) {
      console.log(`   📋 M-Pesa válidas encontradas: ${mPesaValidas.join(', ')}`);
      console.log(`   📋 E-Mola válidas encontradas: ${referenciasEMola.join(', ')}`);
    }
    
    console.log(`✅ COMPLETUDE: ${referenciasCompletas} referência(s) aparentemente completa(s) encontrada(s)`);
    
    return {
      completo: referenciasCompletas > 0,
      referenciasCompletas: referenciasCompletas,
      mPesaCompletas: mPesaValidas.length,
      eMolaCompletas: referenciasEMola.length,
      fragmentosSuspeitos: fragmentosSuspeitos,
      referenciasEncontradas: {
        mPesa: mPesaValidas,
        eMola: referenciasEMola
      }
    };
  }

  // === VALIDAR REFERÊNCIA MOÇAMBIQUE ===
  validarReferenciaMozambique(referencia, valor) {
    if (!referencia || typeof referencia !== 'string') {
      return { valida: false, motivo: 'Referência vazia ou inválida' };
    }

    const ref = referencia.trim().toUpperCase();
    
    // VALIDAÇÃO 1: Verificar se não é número de telefone
    if (/^(258|84|85|86|87)\d{6,9}$/.test(ref)) {
      return { valida: false, motivo: 'Parece ser número de telefone' };
    }
    
    // VALIDAÇÃO 2: Verificar se não é valor monetário
    if (/^\d+([.,]\d{1,2})?$/.test(ref)) {
      return { valida: false, motivo: 'Parece ser valor monetário' };
    }
    
    // VALIDAÇÃO 3: Muito curto
    if (ref.length < 8) {
      return { valida: false, motivo: 'Muito curto (< 8 caracteres)' };
    }
    
    // VALIDAÇÃO 4: Muito longo
    if (ref.length > 20) {
      return { valida: false, motivo: 'Muito longo (> 20 caracteres)' };
    }
    
    // VALIDAÇÃO 5: Padrões específicos válidos
    
    // E-Mola: PP + AAMMDD + . + HHMM + . + Letra + 5 números
    // Exemplo: PP250914.1134.T38273
    if (/^PP\d{6}\.\d{4}\.[A-Za-z]\d{5}$/.test(ref)) {
      return { valida: true, tipo: 'E-Mola padrão oficial' };
    }
    
    // M-Pesa: Exatamente 11 caracteres alfanuméricos misturados
    // Deve ter pelo menos 1 letra e 1 número
    if (ref.length === 11 && /^[A-Z0-9]+$/.test(ref) && /[A-Z]/.test(ref) && /[0-9]/.test(ref)) {
      return { valida: true, tipo: 'M-Pesa padrão oficial' };
    }
    
    // VALIDAÇÃO 6: Padrão genérico (deve ter pelo menos algumas letras)
    const temLetras = /[A-Z]/.test(ref);
    const temNumeros = /\d/.test(ref);
    const somenteAlfanumerico = /^[A-Z0-9]+$/.test(ref);
    
    if (temLetras && temNumeros && somenteAlfanumerico && ref.length >= 8 && ref.length <= 15) {
      return { valida: true, tipo: 'Genérico válido' };
    }
    
    return { 
      valida: false, 
      motivo: `Padrão não reconhecido: ${ref.length} chars, letras: ${temLetras}, números: ${temNumeros}` 
    };
  }

  // === VALIDAÇÃO DE CONSISTÊNCIA E-MOLA ===
  validarConsistenciaEMola(referencia, valor) {
    try {
      // Extrair data e hora da referência E-Mola: PP250914.1134.T38273
      const match = referencia.match(/^PP(\d{2})(\d{2})(\d{2})\.(\d{2})(\d{2})\.[A-Za-z](\d{5})$/);
      if (!match) {
        return { valida: false, motivo: 'Formato E-Mola inválido na validação de consistência' };
      }

      const [, ano, mes, dia, hora, minuto, codigo] = match;
      
      // VALIDAÇÃO 1: Data válida
      const anoCompleto = parseInt('20' + ano);
      const mesNum = parseInt(mes);
      const diaNum = parseInt(dia);
      
      if (mesNum < 1 || mesNum > 12) {
        return { valida: false, motivo: `E-Mola: Mês inválido (${mesNum})` };
      }
      
      if (diaNum < 1 || diaNum > 31) {
        return { valida: false, motivo: `E-Mola: Dia inválido (${diaNum})` };
      }
      
      // VALIDAÇÃO 2: Hora válida
      const horaNum = parseInt(hora);
      const minutoNum = parseInt(minuto);
      
      if (horaNum > 23) {
        return { valida: false, motivo: `E-Mola: Hora inválida (${horaNum})` };
      }
      
      if (minutoNum > 59) {
        return { valida: false, motivo: `E-Mola: Minuto inválido (${minutoNum})` };
      }
      
      // VALIDAÇÃO 3: Data não muito antiga (máximo 6 meses)
      const dataTransacao = new Date(anoCompleto, mesNum - 1, diaNum, horaNum, minutoNum);
      const agora = new Date();
      const seisEMeses = 6 * 30 * 24 * 60 * 60 * 1000;
      
      if ((agora - dataTransacao) > seisEMeses) {
        console.log(`⚠️ E-Mola: Transação muito antiga (${dataTransacao.toLocaleDateString()})`);
      }
      
      // VALIDAÇÃO 4: Código sequencial válido
      const codigoNum = parseInt(codigo);
      if (codigoNum === 0) {
        return { valida: false, motivo: 'E-Mola: Código sequencial inválido (00000)' };
      }
      
      console.log(`✅ E-Mola consistente: ${diaNum}/${mesNum}/${anoCompleto} às ${horaNum}:${minutoNum} [${codigo}]`);
      return { valida: true, motivo: 'E-Mola consistente' };
      
    } catch (error) {
      console.error(`❌ Erro validação E-Mola: ${error.message}`);
      return { valida: false, motivo: `Erro na validação E-Mola: ${error.message}` };
    }
  }

  // === VALIDAÇÃO DE CONSISTÊNCIA M-PESA ===
  validarConsistenciaMPesa(referencia, valor) {
    try {
      // VALIDAÇÃO 1: Padrão específico M-Pesa - deve ser bem distribuído
      const letras = referencia.match(/[A-Z]/g) || [];
      const numeros = referencia.match(/\d/g) || [];
      
      if (letras.length < 2) {
        return { valida: false, motivo: 'M-Pesa: Poucas letras (mínimo 2)' };
      }
      
      if (numeros.length < 3) {
        return { valida: false, motivo: 'M-Pesa: Poucos números (mínimo 3)' };
      }
      
      // VALIDAÇÃO 2: Não deve ser sequência óbvia
      const sequencias = ['1234567890', 'ABCDEFGHIJK', '0000000000', 'AAAAAAAAAAA'];
      for (const seq of sequencias) {
        if (referencia.includes(seq.substring(0, 5))) {
          return { valida: false, motivo: 'M-Pesa: Sequência muito óbvia detectada' };
        }
      }
      
      // VALIDAÇÃO 3: Distribuição balanceada
      const primeiraMetade = referencia.substring(0, 5);
      const segundaMetade = referencia.substring(6, 11);
      
      const letrasP1 = (primeiraMetade.match(/[A-Z]/g) || []).length;
      const letrasP2 = (segundaMetade.match(/[A-Z]/g) || []).length;
      
      // Pelo menos uma letra em cada metade é indicativo de boa distribuição
      if (letrasP1 === 0 || letrasP2 === 0) {
        console.log(`⚠️ M-Pesa: Distribuição desbalanceada [${letrasP1}|${letrasP2}]`);
      }
      
      console.log(`✅ M-Pesa consistente: ${letras.length} letras, ${numeros.length} números`);
      return { valida: true, motivo: 'M-Pesa consistente' };
      
    } catch (error) {
      console.error(`❌ Erro validação M-Pesa: ${error.message}`);
      return { valida: false, motivo: `Erro na validação M-Pesa: ${error.message}` };
    }
  }

  // === VALIDAÇÃO CRUZADA DE DADOS (SIMPLIFICADA) ===
  validarConsistenciaComprovante(referencia, valor, textoCompleto = '') {
    try {
      console.log(`🔍 VALIDAÇÃO CRUZADA: ref=${referencia}, valor=${valor}MT`);
      
      const inconsistencias = [];
      
      // VALIDAÇÃO 1: Verificar duplicidade de referência (ÚNICA VALIDAÇÃO RIGOROSA)
      if (this.referencias_processadas && this.referencias_processadas.has(referencia)) {
        const ultimoUso = this.referencias_processadas.get(referencia);
        const tempoDecorrido = Date.now() - ultimoUso;
        const duasHoras = 2 * 60 * 60 * 1000;
        
        if (tempoDecorrido < duasHoras) {
          inconsistencias.push(`Referência ${referencia} já foi processada há ${Math.floor(tempoDecorrido/60000)} minutos`);
        }
      }
      
      // VALIDAÇÃO 2: Apenas valores extremos
      if (valor) {
        const valorNum = parseFloat(valor);
        if (valorNum <= 0) {
          inconsistencias.push(`Valor inválido: ${valor}MT`);
        }
        if (valorNum > 100000) {
          inconsistencias.push(`Valor extremamente alto: ${valor}MT`);
        }
      }
      
      if (inconsistencias.length > 0) {
        console.log(`❌ INCONSISTÊNCIAS DETECTADAS:`, inconsistencias);
        return {
          valida: false,
          inconsistencias: inconsistencias,
          motivo: `${inconsistencias.length} inconsistência(s) detectada(s)`
        };
      }
      
      console.log(`✅ VALIDAÇÃO CRUZADA: Dados consistentes`);
      return { valida: true, motivo: 'Dados consistentes' };
      
    } catch (error) {
      console.error(`❌ Erro validação cruzada: ${error.message}`);
      return { valida: true, motivo: 'Erro na validação - permitindo processamento' }; // FALHA SEGURA
    }
  }

  // === BUSCAR REFERÊNCIA ALTERNATIVA ===
  buscarReferenciaAlternativa(texto) {
    console.log(`🔍 Buscando referência alternativa no texto...`);
    
    // Padrões mais específicos para busca direta baseados nos padrões oficiais
    const padroes = [
      // E-Mola: PP + 6 dígitos + . + 4 dígitos + . + letra + 5 números
      /PP\d{6}\.\d{4}\.[A-Za-z]\d{5}/gi,
      // M-Pesa: Exatamente 11 caracteres alfanuméricos misturados
      /\b[A-Z0-9]{11}\b/g,
      // E-Mola com possíveis espaços: PP 250914.1134.T38273
      /PP\s*\d{6}\.\d{4}\.[A-Za-z]\d{5}/gi,
      // Qualquer código que pareça ser referência válida
      /\b[A-Z][A-Z0-9]{7,19}\b/g
    ];
    
    for (const padrao of padroes) {
      const matches = texto.match(padrao);
      if (matches && matches.length > 0) {
        // Filtrar candidatos válidos
        for (const match of matches) {
          const validacao = this.validarReferenciaMozambique(match);
          if (validacao.valida) {
            console.log(`✅ Referência alternativa encontrada: ${match} (${validacao.tipo})`);
            return match.toUpperCase();
          }
        }
      }
    }
    
    console.log(`❌ Nenhuma referência alternativa válida encontrada`);
    return null;
  }

  // === TENTAR ABORDAGENS ALTERNATIVAS ===
  async tentarAbordagensAlternativas(textoExtraido) {
    console.log(`🔄 Testando abordagens alternativas para extração...`);
    
    // ABORDAGEM 1: Reconstrução manual mais agressiva
    const textoReconstruido = this.reconstrucaoManualAgressiva(textoExtraido);
    if (textoReconstruido !== textoExtraido) {
      console.log(`🔧 Tentativa 1: Reconstrução manual agressiva aplicada`);
      const resultado1 = await this.interpretarComprovanteComGPT(textoReconstruido);
      if (resultado1.encontrado) {
        console.log(`✅ Abordagem 1 funcionou!`);
        return resultado1;
      }
    }
    
    // ABORDAGEM 2: Busca por padrões regex diretos
    console.log(`🔧 Tentativa 2: Busca direta por padrões regex`);
    const resultado2 = this.extrairDiretoPorRegex(textoExtraido);
    if (resultado2.encontrado) {
      console.log(`✅ Abordagem 2 funcionou!`);
      this.imagemStats.metodos.regex_direto++;
      return resultado2;
    }
    
    // ABORDAGEM 3: Prompt simplificado para GPT
    console.log(`🔧 Tentativa 3: Prompt simplificado`);
    const resultado3 = await this.interpretarComPromptSimplificado(textoExtraido);
    if (resultado3.encontrado) {
      console.log(`✅ Abordagem 3 funcionou!`);
      this.imagemStats.metodos.prompt_simplificado++;
      return resultado3;
    }
    
    console.log(`❌ Todas as abordagens alternativas falharam`);
    return { encontrado: false };
  }

  // === RECONSTRUÇÃO FORÇADA PARA FRAGMENTOS SUSPEITOS ===
  reconstrucaoForcadaFragmentos(texto) {
    console.log(`🔧 RECONSTRUÇÃO FORÇADA: Tentando conectar fragmentos suspeitos...`);
    
    let textoProcessado = texto;
    const completude = this.validarCompletude(texto);
    
    if (completude.fragmentosSuspeitos.length === 0) {
      console.log(`ℹ️ Nenhum fragmento suspeito detectado para reconstrução forçada`);
      return texto;
    }
    
    // FOCO EM M-PESA: Procurar padrões 10+1 caracteres mais agressivamente
    completude.fragmentosSuspeitos.forEach(suspeito => {
      if (suspeito.tipo.includes('M-Pesa')) {
        console.log(`🎯 RECONSTRUÇÃO FORÇADA M-Pesa: "${suspeito.fragmento}" (faltam ${suspeito.caracteresFaltando} char(s))`);
        
        // Buscar caracteres próximos com maior flexibilidade
        const regexes = [
          // Próximo na mesma linha ou linha seguinte
          new RegExp(`(${suspeito.fragmento})\\s*\\n?\\s*([A-Z0-9]{1,${suspeito.caracteresFaltando}})(?=\\s|$|\\n|\\.|,)`, 'gi'),
          // Próximo com possível pontuação no meio
          new RegExp(`(${suspeito.fragmento})[\\s\\n\\.\\,\\-]*([A-Z0-9]{1,${suspeito.caracteresFaltando}})(?=\\s|$|\\n|\\.|,)`, 'gi'),
          // Próximo em qualquer lugar (busca mais ampla)
          new RegExp(`(${suspeito.fragmento})[\\s\\S]{0,10}?([A-Z0-9]{1,${suspeito.caracteresFaltando}})(?=\\s|$|\\n|\\.|,)`, 'gi')
        ];
        
        for (let i = 0; i < regexes.length; i++) {
          const matches = Array.from(textoProcessado.matchAll(regexes[i]));
          
          if (matches.length > 0) {
            matches.forEach(match => {
              const fragmento = match[1];
              const complemento = match[2];
              const candidato = fragmento + complemento;
              
              // Validar se o candidato final é uma referência M-Pesa válida
              if (candidato.length === 11 && /^[A-Z0-9]+$/.test(candidato) && /[A-Z]/.test(candidato) && /[0-9]/.test(candidato)) {
                const original = match[0];
                textoProcessado = textoProcessado.replace(original, candidato);
                console.log(`   ✅ RECONSTRUÇÃO FORÇADA SUCESSO (método ${i+1}): "${original}" → "${candidato}"`);
                
                // Incrementar métrica
                this.imagemStats.referencias_reconstruidas++;
              } else {
                console.log(`   ❌ RECONSTRUÇÃO FORÇADA FALHOU (método ${i+1}): "${candidato}" não é M-Pesa válido`);
              }
            });
            break; // Se encontrou algo neste método, não tentar os próximos
          }
        }
      }
    });
    
    return textoProcessado;
  }

  // === RECONSTRUÇÃO MANUAL AGRESSIVA ===
  reconstrucaoManualAgressiva(texto) {
    console.log(`🔧 Aplicando reconstrução manual agressiva...`);
    
    let textoProcessado = texto;
    
    // NOVA: Aplicar reconstrução forçada primeiro
    textoProcessado = this.reconstrucaoForcadaFragmentos(textoProcessado);
    
    // Remove espaços excessivos e padroniza quebras
    textoProcessado = textoProcessado.replace(/\s+/g, ' ').trim();
    
    // Restaura quebras de linha importantes
    textoProcessado = textoProcessado.replace(/\. /g, '.\n');
    textoProcessado = textoProcessado.replace(/([A-Z]{3,}) ([A-Z0-9]{2,})/g, '$1$2');
    textoProcessado = textoProcessado.replace(/(PP\d{6}\.\d{4}\.) ([A-Z]\d+)/g, '$1$2');
    
    return textoProcessado;
  }

  // === EXTRAIR DIRETO POR REGEX ===
  extrairDiretoPorRegex(texto) {
    console.log(`🔍 Buscando padrões diretos com regex...`);
    
    // Padrões de referência baseados nos padrões oficiais
    const padroes = [
      /(PP\d{6}\.\d{4}\.[A-Za-z]\d{5})/g,     // E-Mola padrão oficial
      /([A-Z0-9]{11})/g,                       // M-Pesa padrão oficial (11 chars)
      /(PP\s*\d{6}\.\d{4}\.[A-Za-z]\d{5})/g,  // E-Mola com espaços
      /([A-Z0-9]{8,15})/g                      // Genérico para casos especiais
    ];
    
    // Padrões de valor
    const padroesValor = [
      /(\d+[.,]\d{2})\s*MT/gi,
      /(\d+)\s*MT/gi,
      /Valor[:\s]+(\d+[.,]?\d*)/gi
    ];
    
    let referencia = null;
    let valor = null;
    
    // Buscar referência com validação rigorosa
    for (const padrao of padroes) {
      const match = texto.match(padrao);
      if (match && match.length > 0) {
        // Usar validação para filtrar candidatos
        for (const candidato of match) {
          const validacao = this.validarReferenciaMozambique(candidato);
          if (validacao.valida) {
            console.log(`✅ Regex encontrou referência válida: ${candidato} (${validacao.tipo})`);
            referencia = candidato.toUpperCase();
            break;
          }
        }
        
        if (referencia) break;
      }
    }
    
    // Buscar valor
    for (const padrao of padroesValor) {
      const match = texto.match(padrao);
      if (match && match[1]) {
        valor = match[1].replace(',', '.');
        break;
      }
    }
    
    if (referencia && valor) {
      console.log(`✅ Regex encontrou: ${referencia} - ${valor}MT`);
      return { 
        encontrado: true, 
        referencia: referencia, 
        valor: valor 
      };
    }
    
    console.log(`❌ Regex não encontrou padrões válidos`);
    return { encontrado: false };
  }

  // === INTERPRETAR COM PROMPT SIMPLIFICADO ===
  async interpretarComPromptSimplificado(textoExtraido) {
    const promptSimples = `Extrai só a referência e valor deste comprovante:
"${textoExtraido}"

Resposta JSON: {"encontrado":true,"referencia":"CODIGO","valor":"125"} ou {"encontrado":false}`;

    try {
      const resposta = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: promptSimples }],
        max_tokens: 50,
        temperature: 0
      });

      return this.extrairJSON(resposta.choices[0].message.content);
    } catch (error) {
      console.error('❌ Erro no prompt simplificado:', error.message);
      return { encontrado: false };
    }
  }

  // === PROCESSAMENTO DE IMAGEM MELHORADO ===
  async processarImagem(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   📸 ATACADO: Processando imagem de ${remetente} com método híbrido (Google Vision + GPT-4)`);
    
    // Usar o novo método híbrido Google Vision + GPT-4
    return await this.processarImagemHibrida(imagemBase64, remetente, timestamp, configGrupo, legendaImagem);
  }

  // === OBTER ESTATÍSTICAS DE PROCESSAMENTO DE IMAGENS ===
  getImagemStats() {
    const stats = this.imagemStats;
    const taxaSucesso = stats.total > 0 ? ((stats.sucessos / stats.total) * 100).toFixed(1) : '0.0';
    
    let relatorio = `📊 *ESTATÍSTICAS DE PROCESSAMENTO DE IMAGENS ROBUSTAS*\n`;
    relatorio += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    relatorio += `📈 **RESUMO GERAL**\n`;
    relatorio += `• Total processadas: ${stats.total}\n`;
    relatorio += `• Sucessos: ${stats.sucessos} (${taxaSucesso}%)\n`;
    relatorio += `• Falhas: ${stats.falhas}\n\n`;
    
    relatorio += `🔧 **MÉTODOS UTILIZADOS**\n`;
    relatorio += `• Híbrido direto: ${stats.metodos.hibrido_direto}\n`;
    relatorio += `• Abordagem alternativa: ${stats.metodos.abordagem_alternativa}\n`;
    relatorio += `• Regex direto: ${stats.metodos.regex_direto}\n`;
    relatorio += `• Prompt simplificado: ${stats.metodos.prompt_simplificado}\n`;
    relatorio += `• GPT-4 Vision fallback: ${stats.metodos.gpt4_vision_fallback}\n\n`;
    
    relatorio += `🔍 **PROCESSAMENTO DE REFERÊNCIAS**\n`;
    relatorio += `• Referencias reconstruídas: ${stats.referencias_reconstruidas}\n`;
    relatorio += `• Referencias validadas: ${stats.referencias_validadas}\n`;
    relatorio += `• Referencias rejeitadas: ${stats.referencias_rejeitadas}\n\n`;
    
    relatorio += `💾 **CACHE E TOKENS**\n`;
    relatorio += `• Chamadas GPT: ${this.tokenStats.calls}\n`;
    relatorio += `• Cache hits: ${this.tokenStats.cacheHits}\n`;
    
    const taxaCache = this.tokenStats.calls > 0 ? 
      ((this.tokenStats.cacheHits / (this.tokenStats.calls + this.tokenStats.cacheHits)) * 100).toFixed(1) : '0.0';
    relatorio += `• Taxa de cache: ${taxaCache}%`;
    
    return relatorio;
  }

  // === RESETAR ESTATÍSTICAS ===
  resetImagemStats() {
    this.imagemStats = {
      total: 0,
      sucessos: 0,
      falhas: 0,
      metodos: {
        hibrido_direto: 0,
        abordagem_alternativa: 0,
        regex_direto: 0,
        prompt_simplificado: 0,
        gpt4_vision_fallback: 0
      },
      referencias_reconstruidas: 0,
      referencias_validadas: 0,
      referencias_rejeitadas: 0
    };
    
    console.log('📊 Estatísticas de processamento de imagens resetadas');
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

  // === ANALISAR COMPROVANTE (VERSÃO ROBUSTA - ACEITA QUALQUER FORMATO + VALIDAÇÃO RIGOROSA) ===
  async analisarComprovante(mensagem, configGrupo = null) {
    // DETECÇÃO MÚLTIPLA: Verificar diferentes indicadores de comprovante
    const temConfirmado = /^confirmado/i.test(mensagem.trim());
    const temID = /^id\s/i.test(mensagem.trim());
    const temIDdaTransacao = /^id da transacao/i.test(mensagem.trim());
    const temTransferiste = /transferiste\s+\d+/i.test(mensagem);
    
    // DETECÇÃO ROBUSTA: Procurar por padrões de referência E valor em QUALQUER lugar do texto
    const temReferenciaEMola = /PP\d{6}\.\d{4}\.[A-Za-z]\d{5}/i.test(mensagem);
    const temReferenciaMPesa = /\b[A-Z0-9]{11}\b/i.test(mensagem);
    const temValorMT = /\d+(?:[.,]\d{1,2})?\s*MT/i.test(mensagem);
    const temValorTransferido = /(?:valor|transferiste|montante)\s*:?\s*\d+/i.test(mensagem);
    
    // CRITÉRIO FLEXÍVEL: Aceitar se for formato tradicional OU se tiver referência + valor
    const formatoTradicional = temConfirmado || temID || temIDdaTransacao || temTransferiste;
    const temDadosCompletos = (temReferenciaEMola || temReferenciaMPesa) && (temValorMT || temValorTransferido);
    
    if (formatoTradicional) {
      console.log(`🎯 ATACADO: Comprovante FORMATO TRADICIONAL - Confirmado:${temConfirmado} ID:${temID} IDTransacao:${temIDdaTransacao} Transferiste:${temTransferiste}`);
    } else if (temDadosCompletos) {
      console.log(`🎯 ATACADO: Comprovante FORMATO FLEXÍVEL - EMola:${temReferenciaEMola} MPesa:${temReferenciaMPesa} ValorMT:${temValorMT} ValorTransf:${temValorTransferido}`);
    } else {
      console.log(`❌ ATACADO: Texto não reconhecido como comprovante - faltam dados essenciais`);
      return null;
    }

    // EXTRAÇÃO DIRETA POR REGEX ROBUSTA (MÚLTIPLOS PADRÕES)
    try {
      let referencia = null;
      let valor = null;
      
      // BUSCAR REFERÊNCIA: Múltiplos padrões
      const padroesRef = [
        // Padrões tradicionais
        /(?:ID da transacao|Confirmado)\s+([A-Z0-9][A-Z0-9.]*[A-Z0-9])/i,
        // E-Mola direto
        /(PP\d{6}\.\d{4}\.[A-Za-z]\d{5})/i,
        // M-Pesa direto (11 caracteres)
        /\b([A-Z0-9]{11})\b/,
        // Qualquer código após palavras-chave
        /(?:referencia|codigo|ref|id)\s*:?\s*([A-Z0-9][A-Z0-9.]{7,})/i,
        // Código isolado que pareça ser referência
        /\b([A-Z][A-Z0-9]{7,19})\b/
      ];
      
      for (const padrao of padroesRef) {
        const matches = [...mensagem.matchAll(new RegExp(padrao.source, padrao.flags + 'g'))];
        
        for (const match of matches) {
          const candidato = match[1];
          if (candidato) {
            const validacao = this.validarReferenciaMozambique(candidato);
            if (validacao.valida) {
              referencia = candidato.trim();
              console.log(`✅ Referência encontrada via regex: ${referencia} (${validacao.tipo})`);
              break;
            }
          }
        }
        
        if (referencia) break;
      }
      
      // BUSCAR VALOR: Múltiplos padrões
      const padroesValor = [
        /Transferiste\s+(\d+(?:[.,]\d{1,2})?)MT/i,
        /(?:valor|montante)\s*:?\s*(\d+(?:[.,]\d{1,2})?)\s*MT/i,
        /(\d+(?:[.,]\d{1,2})?)\s*MT/i,
        /(?:valor|montante)\s*:?\s*(\d+(?:[.,]\d{1,2})?)/i
      ];
      
      for (const padrao of padroesValor) {
        const match = mensagem.match(padrao);
        if (match && match[1]) {
          valor = match[1].replace(',', '.');
          console.log(`✅ Valor encontrado via regex: ${valor}MT`);
          break;
        }
      }
      
      if (referencia && valor) {
        const valorLimpo = this.limparValor(valor);
        console.log(`🎯 ATACADO: Extração DIRETA ROBUSTA - Ref:${referencia} Valor:${valorLimpo}MT`);
        
        // ======= VALIDAÇÃO RIGOROSA DE VALOR =======
        if (configGrupo) {
          const validacao = this.validarValorContraTabela(valorLimpo, configGrupo);
          if (!validacao.valido) {
            console.log(`❌ VALIDAÇÃO RIGOROSA: Valor ${valorLimpo}MT REJEITADO - ${validacao.motivo}`);
            return {
              encontrado: false,
              valor_invalido: valorLimpo,
              referencia: referencia,
              motivo: 'valor_nao_esta_na_tabela',
              valores_validos: validacao.valoresValidos,
              mensagem_erro: `❌ *VALOR INVÁLIDO!*\n\n📋 *REFERÊNCIA:* ${referencia}\n💰 *VALOR ENVIADO:* ${valorLimpo}MT\n\n⚠️ Este valor não está na nossa tabela de preços.\n\n📋 *VALORES VÁLIDOS:*\n${validacao.valoresValidos.map(v => `• ${v}MT`).join('\n')}\n\n💡 Digite *tabela* para ver todos os pacotes disponíveis.`
            };
          }
          console.log(`✅ VALIDAÇÃO RIGOROSA: Valor ${valorLimpo}MT APROVADO`);
        }
        
        // ====== VALIDAÇÃO DE CONSISTÊNCIA ENTRE DADOS ======
        const validacaoConsistencia = this.validarConsistenciaComprovante(
          referencia, 
          valorLimpo, 
          mensagem
        );
        
        if (!validacaoConsistencia.valida) {
          console.log(`❌ VALIDAÇÃO CONSISTÊNCIA (REGEX): ${validacaoConsistencia.motivo}`);
          return {
            encontrado: false,
            referencia: referencia,
            valor_invalido: valorLimpo,
            motivo: 'dados_inconsistentes',
            inconsistencias: validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo],
            mensagem_erro: `❌ *DADOS INCONSISTENTES!*\n\n📋 *REFERÊNCIA:* ${referencia}\n💰 *VALOR:* ${valorLimpo}MT\n\n⚠️ *PROBLEMAS:*\n${(validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo]).map(inc => `• ${inc}`).join('\n')}\n\n💡 Verifique o comprovante e tente novamente.`
          };
        }
        
        // REGISTRAR REFERÊNCIA COMO PROCESSADA
        if (this.referencias_processadas) {
          this.referencias_processadas.set(referencia, Date.now());
        }
        
        return {
          referencia: referencia,
          valor: valorLimpo,
          fonte: 'regex_direto_robusto'
        };
      } else {
        console.log(`⚠️ ATACADO: Extração parcial - Ref:${referencia || 'NULO'} Valor:${valor || 'NULO'}`);
      }
    } catch (regexError) {
      console.log(`⚠️ ATACADO: Regex robusto falhou, tentando IA... Erro: ${regexError.message}`);
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
        const valorLimpo = this.limparValor(resultado.valor);
        
        // ======= VALIDAÇÃO RIGOROSA DE VALOR (IA) =======
        if (configGrupo) {
          const validacao = this.validarValorContraTabela(valorLimpo, configGrupo);
          if (!validacao.valido) {
            console.log(`❌ VALIDAÇÃO RIGOROSA (IA): Valor ${valorLimpo}MT REJEITADO - ${validacao.motivo}`);
            const resultadoInvalido = {
              encontrado: false,
              valor_invalido: valorLimpo,
              referencia: resultado.referencia,
              motivo: 'valor_nao_esta_na_tabela',
              valores_validos: validacao.valoresValidos,
              mensagem_erro: `❌ *VALOR INVÁLIDO!*\n\n📋 *REFERÊNCIA:* ${resultado.referencia}\n💰 *VALOR ENVIADO:* ${valorLimpo}MT\n\n⚠️ Este valor não está na nossa tabela de preços.\n\n📋 *VALORES VÁLIDOS:*\n${validacao.valoresValidos.map(v => `• ${v}MT`).join('\n')}\n\n💡 Digite *tabela* para ver todos os pacotes disponíveis.`
            };
            
            // Salvar resultado inválido no cache
            this.cacheResultados.set(cacheKey, {
              resultado: resultadoInvalido,
              timestamp: Date.now()
            });
            
            return resultadoInvalido;
          }
          console.log(`✅ VALIDAÇÃO RIGOROSA (IA): Valor ${valorLimpo}MT APROVADO`);
        }
        
        // ====== VALIDAÇÃO DE CONSISTÊNCIA ENTRE DADOS (IA) ======
        const validacaoConsistencia = this.validarConsistenciaComprovante(
          resultado.referencia, 
          valorLimpo, 
          mensagem
        );
        
        if (!validacaoConsistencia.valida) {
          console.log(`❌ VALIDAÇÃO CONSISTÊNCIA (IA): ${validacaoConsistencia.motivo}`);
          const resultadoInconsistente = {
            encontrado: false,
            referencia: resultado.referencia,
            valor_invalido: valorLimpo,
            motivo: 'dados_inconsistentes',
            inconsistencias: validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo],
            mensagem_erro: `❌ *DADOS INCONSISTENTES!*\n\n📋 *REFERÊNCIA:* ${resultado.referencia}\n💰 *VALOR:* ${valorLimpo}MT\n\n⚠️ *PROBLEMAS:*\n${(validacaoConsistencia.inconsistencias || [validacaoConsistencia.motivo]).map(inc => `• ${inc}`).join('\n')}\n\n💡 Verifique o comprovante e tente novamente.`
          };
          
          // Salvar resultado inconsistente no cache
          this.cacheResultados.set(cacheKey, {
            resultado: resultadoInconsistente,
            timestamp: Date.now()
          });
          
          return resultadoInconsistente;
        }
        
        // REGISTRAR REFERÊNCIA COMO PROCESSADA
        if (this.referencias_processadas) {
          this.referencias_processadas.set(resultado.referencia, Date.now());
        }
        
        const comprovanteProcessado = {
          referencia: resultado.referencia,
          valor: valorLimpo,
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

  // === LIMPAR REFERÊNCIAS ANTIGAS ===
  limparReferenciasAntigas() {
    if (!this.referencias_processadas) return;
    
    const agora = Date.now();
    const seisHoras = 6 * 60 * 60 * 1000; // 6 horas
    let removidas = 0;
    
    for (const [referencia, timestamp] of this.referencias_processadas.entries()) {
      if (agora - timestamp > seisHoras) {
        this.referencias_processadas.delete(referencia);
        removidas++;
      }
    }
    
    if (removidas > 0) {
      console.log(`🧹 Referências: ${removidas} referências antigas removidas`);
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
