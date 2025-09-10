const { OpenAI } = require("openai");
const vision = require('@google-cloud/vision');

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100;
    
    // Configurar Google Vision (COPIADO EXATAMENTE DO BOT DE REFERÊNCIA)
    this.googleVisionEnabled = process.env.GOOGLE_VISION_ENABLED === 'true';
    this.googleVisionTimeout = parseInt(process.env.GOOGLE_VISION_TIMEOUT) || 10000;
    
    if (this.googleVisionEnabled) {
      try {
        // Tentar inicializar Google Vision
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          // Usando arquivo de credenciais
          this.visionClient = new vision.ImageAnnotatorClient();
          console.log('🔍 Google Vision inicializado com arquivo de credenciais');
        } else if (process.env.GOOGLE_VISION_API_KEY) {
          // Usando API Key
          this.visionClient = new vision.ImageAnnotatorClient({
            apiKey: process.env.GOOGLE_VISION_API_KEY
          });
          console.log('🔍 Google Vision inicializado com API Key');
        } else {
          console.log('⚠️ Google Vision desabilitado: credenciais não encontradas');
          this.googleVisionEnabled = false;
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar Google Vision:', error.message);
        this.googleVisionEnabled = false;
      }
    }
    
    setInterval(() => {
      this.limparComprovantesAntigos();
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

  // === INTERPRETAR COMPROVANTE COM GPT (TEXTO PURO) ===
  async interpretarComprovanteComGPT(textoExtraido) {
    console.log('🧠 Interpretando texto extraído com GPT-4...');
    
    const prompt = `
Analisa este texto extraído de um comprovante M-Pesa ou E-Mola de Moçambique:

"${textoExtraido}"

Procura por:
1. Referência da transação (exemplos: CGC4GQ17W84, PP250712.2035.u31398, etc.)
2. Valor transferido (em MT - Meticais)

INSTRUÇÕES IMPORTANTES:
- A REFERÊNCIA pode estar QUEBRADA em múltiplas linhas. Ex: "PP250901.1250.B" + "64186" = "PP250901.1250.B64186"
- RECONSTRÓI referências que estão separadas por quebras de linha
- Procura por "ID da transacao", "Confirmado", "Transferiste"
- Valores sempre têm "MT" (ex: "250.00 MT", "125 MT")
- Referências E-Mola: formato como PP250901.1250.B64186
- Referências M-Pesa: formato como CGC4GQ17W84

IMPORTANTE: Analisa TODO o texto e encontra a MELHOR correspondência.

Responde APENAS em JSON:
{
  "encontrado": true/false,
  "referencia": "referencia_encontrada",
  "valor": valor_numerico
}`;

    try {
      const resposta = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.1
      });

      console.log(`🔍 Resposta GPT-4: ${resposta.choices[0].message.content}`);
      
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      console.log(`✅ JSON extraído (GPT-4):`, resultado);
      
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
      throw error;
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
    console.log(`   🔍 ATACADO: Extraindo JSON melhorado de: ${texto}`);
    
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
          try {
            const refMatch = texto.match(/["']?referencia["']?\s*:\s*["']([^"']+)["']/i);
            const valorMatch = texto.match(/["']?valor["']?\s*:\s*["']?([^"',}]+)["']?/i);
            const encontradoMatch = texto.match(/["']?encontrado["']?\s*:\s*(true|false)/i);
            const tipoMatch = texto.match(/["']?tipo["']?\s*:\s*["']([^"']+)["']/i);
            
            if (refMatch && valorMatch) {
              return {
                referencia: refMatch[1].trim(),
                valor: valorMatch[1].trim(),
                encontrado: encontradoMatch ? encontradoMatch[1] === 'true' : true,
                tipo: tipoMatch ? tipoMatch[1] : 'desconhecido'
              };
            }
          } catch (e4) {
            console.error('❌ ATACADO: Todas as tentativas de parsing falharam:', e4);
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

  // === ANALISAR COMPROVANTE (CÓDIGO ORIGINAL) ===
  async analisarComprovante(mensagem) {
    const temConfirmado = /^confirmado/i.test(mensagem.trim());
    const temID = /^id\s/i.test(mensagem.trim());
    
    if (!temConfirmado && !temID) {
      return null;
    }

    const prompt = `
Analisa esta mensagem de comprovante de pagamento M-Pesa ou E-Mola:

"${mensagem}"

Extrai a referência da transação e o valor transferido.

Responde APENAS no formato JSON:
{
  "referencia": "CGC4GQ17W84",
  "valor": "210",
  "encontrado": true
}

Se não conseguires extrair, responde:
{"encontrado": false}
`;

    const resposta = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Você é especialista em analisar comprovantes de pagamento moçambicanos M-Pesa e E-Mola." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 200
    });

    try {
      const resultado = this.extrairJSONMelhorado(resposta.choices[0].message.content);
      
      if (resultado.encontrado) {
        return {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'texto'
        };
      }
    } catch (parseError) {
      console.error('❌ ATACADO: Erro ao parsear resposta da IA:', parseError);
    }

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
}

module.exports = WhatsAppAIAtacado;
