
const { OpenAI } = require("openai");

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100;
    
    setInterval(() => {
      this.limparComprovantesAntigos();
    }, 10 * 60 * 1000);
    
    console.log('🧠 IA WhatsApp ATACADO COMPLETA v2.2 - Processamento de imagens E texto otimizado');
  }

  // === PROCESSAMENTO DE IMAGEM MELHORADO ===
  async processarImagem(imagemBase64, remetente, timestamp, configGrupo = null, legendaImagem = null) {
    console.log(`   📸 ATACADO: Processando imagem de ${remetente} com IA melhorada`);
    
    const temLegendaValida = legendaImagem && 
                            typeof legendaImagem === 'string' && 
                            legendaImagem.trim().length > 0;
    
    if (temLegendaValida) {
      console.log(`   📝 ATACADO: Legenda detectada: "${legendaImagem.trim()}"`);
    }

    // PROMPT ULTRA ESPECÍFICO - Foco especial em E-MOLA
    const promptMelhorado = `
ANALISE esta imagem de comprovante M-Pesa/E-Mola de Moçambique.

⚠️ ATENÇÃO CRÍTICA - REFERÊNCIAS QUEBRADAS EM MÚLTIPLAS LINHAS:

🟡 FORMATO E-MOLA ESPECÍFICO:
Formato completo: XX######.####.###### (SEMPRE 3 partes separadas por pontos)
⚠️ CRÍTICO: MANTENHA maiúsculas e minúsculas EXATAMENTE como aparecem!

EXEMPLOS REAIS DE E-MOLA que você DEVE capturar EXATOS:
- "PP250821.1152.E58547" (EXATO - com E maiúsculo!)
- "EP240815.1420.h45672" (EXATO - com h minúsculo!)
- "PP250820.1706.e9791" (EXATO - com e minúsculo!)

🚨 NÃO ALTERE MAIÚSCULAS/MINÚSCULAS! O sistema é case-sensitive!

🚨 PROBLEMA COMUM: E-Mola quebrado em linhas
Se você vê na imagem:
Linha 1: "PP250820.1706.e9791"
OU quebrado:
Linha 1: "PP250820.1706."
Linha 2: "e9791"
RESULTADO CORRETO: "PP250820.1706.e9791"

REGRA E-MOLA: Capture TUDO até encontrar a terceira parte completa!
- Primeira parte: letras + números (PP250820)
- Segunda parte: números (1706) 
- Terceira parte: letra + números (e9791) ← NÃO CORTE ESTA PARTE!

🔵 M-PESA (SEM pontos):
⚠️ CRÍTICO: MANTENHA maiúsculas e minúsculas EXATAMENTE como aparecem!
Se você vê:
"CHK8H3PYK" + "pe" (em linhas separadas)
RESULTADO: "CHK8H3PYKpe" (EXATO - não mude para maiúsculo!)

🔍 INSTRUÇÕES DE BUSCA:
1. Procure por "ID da transação" ou "Confirmado"
2. Abaixo/ao lado, encontre o código
3. Para E-Mola: SEMPRE tem 3 partes separadas por pontos
4. Para M-Pesa: código alfanumérico sem pontos
5. SE estiver quebrado em linhas, JUNTE TUDO!

VALOR: Procure valor em MT (ex: "375.00MT")

Responda no formato:
Para E-Mola (SEMPRE com 3 partes e CASE ORIGINAL):
{
  "referencia": "PP250821.1152.E58547",
  "valor": "375",
  "encontrado": true,
  "tipo": "emola"
}

Para M-Pesa (CASE ORIGINAL):
{
  "referencia": "CHK8H3PYKpe",
  "valor": "125",
  "encontrado": true,
  "tipo": "mpesa"
}`;

    try {
      // PRIMEIRA TENTATIVA com prompt melhorado
      let resposta = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptMelhorado },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imagemBase64}`,
                  detail: "high" // Máxima qualidade para melhor leitura
                }
              }
            ]
          }
        ],
        temperature: 0.1, // Mais preciso para primeira tentativa
        max_tokens: 600 // Mais espaço para explicações detalhadas
      });

      console.log(`   🔍 ATACADO: Primeira tentativa - Resposta da IA: ${resposta.choices[0].message.content}`);
      
      let resultado = this.extrairJSONMelhorado(resposta.choices[0].message.content);
      
      // SE A PRIMEIRA TENTATIVA FALHOU, FAZER SEGUNDA TENTATIVA
      if (!resultado || !resultado.encontrado) {
        console.log(`   🔄 ATACADO: Primeira tentativa falhou, tentando novamente com prompt alternativo...`);
        
        const promptAlternativo = `
🚨 SEGUNDA TENTATIVA - FOCO ESPECIAL EM E-MOLA CORTADO!

PROBLEMA IDENTIFICADO: Você está cortando referências E-Mola!

🟡 FORMATO E-MOLA OBRIGATÓRIO:
XX######.####.######
SEMPRE 3 partes separadas por 2 pontos!

EXEMPLOS DO QUE VOCÊ DEVE ENCONTRAR COMPLETO:
✅ "PP250820.1706.e9791" (CORRETO - com 3 partes)
❌ "PP250820.1706.e979" (ERRADO - cortou o último dígito)
❌ "PP250820.1706" (ERRADO - faltou a terceira parte)

🔍 COMO ENCONTRAR E-MOLA COMPLETO:
1. Procure por texto que começa com 2 letras (PP, EP, etc.)
2. Seguido de números e pontos
3. CONTE os pontos: deve ter EXATAMENTE 2 pontos
4. Terceira parte: pode ser letra+números (e9791, h45672, u31398)
5. SE quebrado em linhas, JUNTE TUDO!

CENÁRIO QUEBRADO COMUM:
Se você vê:
"PP250820.1706." (linha 1)
"e9791" (linha 2)
RESULTADO: "PP250820.1706.e9791" ✅

🔵 PARA M-PESA:
Se quebrado: "CHK8H3PYK" + "PE" = "CHK8H3PYKPE"

⚠️ NÃO CORTE E NÃO ALTERE MAIÚSCULAS/MINÚSCULAS! Capture EXATAMENTE como aparece!

Para E-Mola (SEMPRE 3 partes com pontos e CASE ORIGINAL):
{
  "referencia": "PP250821.1152.E58547",
  "valor": "375",
  "encontrado": true,
  "tipo": "emola"
}

Para M-Pesa (sem pontos e CASE ORIGINAL):
{
  "referencia": "CHK8H3PYKpe",
  "valor": "125",
  "encontrado": true,
  "tipo": "mpesa"
}`;

        resposta = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptAlternativo },
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
          temperature: 0.7, // Muito mais criativo na segunda tentativa
          max_tokens: 500
        });

        console.log(`   🔍 ATACADO: Segunda tentativa - Resposta da IA: ${resposta.choices[0].message.content}`);
        resultado = this.extrairJSONMelhorado(resposta.choices[0].message.content);
      }

      // PROCESSAR RESULTADO
      if (resultado && resultado.encontrado) {
        const comprovante = {
          referencia: this.limparReferencia(resultado.referencia),
          valor: this.limparValor(resultado.valor),
          fonte: 'imagem_melhorada',
          confianca: resultado.confianca || 'media',
          tipo: resultado.tipo || 'desconhecido'
        };
        
        console.log(`   ✅ ATACADO: Dados extraídos com sucesso: ${comprovante.referencia} - ${comprovante.valor}MT (${comprovante.tipo}, confiança: ${comprovante.confianca})`);
        
        // VALIDAÇÃO ADICIONAL PARA E-MOLA
        if (comprovante.tipo === 'emola') {
          const pontosCount = (comprovante.referencia.match(/\./g) || []).length;
          if (pontosCount !== 2) {
            console.log(`   ⚠️ ATACADO: ERRO - Referência E-Mola deve ter exatamente 2 pontos! Encontrados: ${pontosCount}`);
            console.log(`   🔧 ATACADO: Referência possivelmente incompleta: ${comprovante.referencia}`);
          }
          
          // Verificar se tem as 3 partes
          const partes = comprovante.referencia.split('.');
          if (partes.length !== 3) {
            console.log(`   ⚠️ ATACADO: ERRO - E-Mola deve ter 3 partes! Encontradas: ${partes.length}`);
            console.log(`   🔧 ATACADO: Partes: ${JSON.stringify(partes)}`);
          } else {
            console.log(`   ✅ ATACADO: E-Mola com formato correto - 3 partes: ${partes.join(' | ')}`);
          }
        }
        // Continuar com o processamento normal...
        if (temLegendaValida) {
          const numeroLegenda = this.extrairNumeroDeLegenda(legendaImagem);
          
          if (numeroLegenda && numeroLegenda.multiplos) {
            return {
              sucesso: false,
              tipo: 'multiplos_numeros_nao_permitido',
              numeros: numeroLegenda.numeros,
              mensagem: 'Sistema atacado aceita apenas UM número por vez.'
            };
          }
          
          if (numeroLegenda) {
            const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
            
            if (megasCalculados) {
              const resultado = `${comprovante.referencia}|${megasCalculados.megas}|${numeroLegenda}`;
              console.log(`   ✅ ATACADO: PEDIDO COMPLETO (IMAGEM + LEGENDA): ${resultado}`);
              return { 
                sucesso: true, 
                dadosCompletos: resultado,
                tipo: 'numero_processado',
                numero: numeroLegenda,
                megas: megasCalculados.megas,
                valorPago: comprovante.valor,
                fonte: 'imagem_com_legenda_melhorada'
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
        }
        
        // Processar comprovante sem número
        const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
        
        if (megasCalculados) {
          await this.processarComprovante(comprovante, remetente, timestamp);
          
          return { 
            sucesso: true, 
            tipo: 'comprovante_imagem_recebido',
            referencia: comprovante.referencia,
            valor: comprovante.valor,
            megas: megasCalculados.megas,
            mensagem: `✅ *COMPROVANTE PROCESSADO!*\n📋 *REF:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n📊 *MEGAS:* ${megasCalculados.megas}\n\n📱 Agora envie UM número para receber os megas.`
          };
        } else {
          return {
            sucesso: false,
            tipo: 'valor_nao_encontrado_na_tabela',
            valor: comprovante.valor,
            mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis`
          };
        }
        
      } else {
        console.log(`   ❌ ATACADO: Ambas as tentativas falharam em extrair dados da imagem`);
        return {
          sucesso: false,
          tipo: 'imagem_nao_reconhecida_melhorada',
          mensagem: `❌ *NÃO CONSEGUI LER A IMAGEM!*\n\n🔍 *Tentei 2 vezes com IA avançada*\n\n📸 *Possíveis problemas:*\n• Imagem muito escura/clara/borrada\n• Texto muito pequeno ou cortado\n• Comprovante incompleto\n• Formato não suportado\n\n💡 *Soluções:*\n• Tire uma foto mais clara e focada\n• Certifique-se que TODO o comprovante está visível\n• Aumente o brilho se estiver escuro\n• Ou envie o comprovante como texto copiado`
        };
      }
      
    } catch (error) {
      console.error('❌ ATACADO: Erro ao processar imagem melhorada:', error);
      return {
        sucesso: false,
        tipo: 'erro_processamento_imagem',
        mensagem: `❌ *ERRO TÉCNICO NA IA!*\n\n🔧 *Detalhes:* ${error.message}\n\n💡 *Soluções:*\n• Tente enviar a imagem novamente\n• Ou envie o comprovante como texto\n• Contate o suporte se persistir`
      };
    }
  }

  // === EXTRAÇÃO DE JSON MELHORADA ===
  extrairJSONMelhorado(texto) {
    console.log(`   🔍 ATACADO: Extraindo JSON melhorado de: ${texto}`);
    
    try {
      // Tentativa 1: JSON direto
      return JSON.parse(texto);
    } catch (e) {
      try {
        // Tentativa 2: Remover markdown
        let limpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(limpo);
      } catch (e2) {
        try {
          // Tentativa 3: Encontrar JSON no texto
          const match = texto.match(/\{[\s\S]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (e3) {
          try {
            // Tentativa 4: Extrair manualmente usando regex
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

  // === LIMPEZA DE REFERÊNCIA MELHORADA - MANTÉM CASE ORIGINAL ===
  limparReferencia(referencia) {
    if (!referencia) return '';
    
    let refLimpa = referencia.toString().trim();
    
    // DETECTAR se é E-Mola (contém pontos) ou M-Pesa
    const eEMola = refLimpa.includes('.');
    
    if (eEMola) {
      // PARA E-MOLA: Manter pontos E CASE ORIGINAL
      refLimpa = refLimpa
        .replace(/\s+/g, '') // Remove apenas espaços e quebras de linha
        .replace(/[^\w.]/g, ''); // Remove caracteres especiais MAS MANTÉM pontos
        // ❌ REMOVIDO: .toLowerCase() - MANTÉM CASE ORIGINAL!
      
      console.log(`   🟡 ATACADO: Referência E-Mola limpa (CASE ORIGINAL): "${referencia}" -> "${refLimpa}"`);
    } else {
      // PARA M-PESA: Remover caracteres especiais MAS MANTER CASE ORIGINAL
      refLimpa = refLimpa
        .replace(/\s+/g, '') // Remove espaços e quebras de linha
        .replace(/[^\w]/g, ''); // Remove caracteres não alfanuméricos (incluindo pontos)
        // ❌ REMOVIDO: .toUpperCase() - MANTÉM CASE ORIGINAL!
      
      console.log(`   🔵 ATACADO: Referência M-Pesa limpa (CASE ORIGINAL): "${referencia}" -> "${refLimpa}"`);
    }
    
    return refLimpa;
  }

  // === FUNÇÃO AUXILIAR PARA LIMPEZA DE NÚMEROS (mantida do código original) ===
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

  // === EXTRAIR NÚMERO DE LEGENDA (mantida do código original) ===
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
    
    const regexNumeros = /(?:\+258\s*)?8[0-9]{8}/g;
    const numerosEncontrados = legendaLimpa.match(regexNumeros) || [];
    
    if (numerosEncontrados.length === 0) {
      return null;
    }
    
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
      }
    }
    
    if (numerosValidos.length === 1) {
      return numerosValidos[0];
    } else if (numerosValidos.length > 1) {
      return { multiplos: true, numeros: numerosValidos };
    }
    
    return null;
  }

  // === CALCULAR MEGAS POR VALOR (mantida do código original) ===
  calcularMegasPorValor(valorPago, configGrupo) {
    console.log(`   🧮 ATACADO: Calculando megas para valor ${valorPago}MT...`);
    
    if (!configGrupo || !configGrupo.tabela) {
      console.log(`   ❌ ATACADO: Tabela do grupo não disponível`);
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

  // === EXTRAIR PREÇOS TABELA (mantida do código original) ===
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
        /(\d+)💫\s*(\d+)MT/gi
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
    
    return precosUnicos;
  }

  // === LIMPAR VALOR MONETÁRIO (mantida do código original) ===
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

  // === RESTO DAS FUNÇÕES MANTIDAS DO CÓDIGO ORIGINAL ===
  async processarMensagemBot(mensagem, remetente, tipoMensagem = 'texto', configGrupo = null, legendaImagem = null) {
    const timestamp = Date.now();
    
    if (tipoMensagem === 'imagem') {
      console.log(`\n🧠 IA ATACADO MELHORADA processando IMAGEM de ${remetente}`);
      if (legendaImagem && legendaImagem.trim().length > 0) {
        console.log(`📝 Com legenda: "${legendaImagem.substring(0, 100)}..."`);
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

  // === PROCESSAR TEXTO (IMPLEMENTAÇÃO COMPLETA) ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo) {
    console.log(`   📝 ATACADO: Analisando mensagem de texto: "${mensagem}"`);
    
    // VERIFICAR PEDIDOS ESPECÍFICOS PRIMEIRO
    if (configGrupo) {
      const pedidosEspecificos = this.analisarPedidosEspecificos(mensagem, configGrupo);
      if (pedidosEspecificos) {
        console.log(`   🎯 ATACADO: PEDIDOS ESPECÍFICOS DETECTADOS!`);
        
        // Verificar se há comprovante na mensagem ou no histórico
        const { textoComprovante } = this.separarComprovanteENumeros(mensagem);
        let comprovante = null;
        
        if (textoComprovante && textoComprovante.length > 10) {
          comprovante = await this.analisarComprovante(textoComprovante);
        }
        
        // Se não encontrou comprovante na mensagem, buscar no histórico
        if (!comprovante) {
          comprovante = await this.buscarComprovanteRecenteNoHistorico(remetente, timestamp);
        }
        
        if (comprovante) {
          const valorPago = parseFloat(comprovante.valor);
          const valorCalculado = pedidosEspecificos.valorTotal;
          
          console.log(`   💰 ATACADO: Valor pago: ${valorPago}MT`);
          console.log(`   🧮 ATACADO: Valor calculado: ${valorCalculado}MT`);
          
          // Verificar se valores batem (tolerância de ±5MT)
          if (Math.abs(valorPago - valorCalculado) <= 5) {
            console.log(`   ✅ ATACADO: VALORES COMPATÍVEIS! Processando pedidos específicos...`);
            
            const resultados = pedidosEspecificos.pedidos.map(pedido => 
              `${comprovante.referencia}|${pedido.preco}|${pedido.numero}`
            );
            
            console.log(`   ✅ ATACADO: PEDIDOS ESPECÍFICOS PROCESSADOS: ${resultados.join(' + ')}`);
            
            return { 
              sucesso: true, 
              dadosCompletos: resultados.join('\n'),
              tipo: 'pedidos_especificos_processados',
              numeros: pedidosEspecificos.numeros,
              pedidos: pedidosEspecificos.pedidos,
              valorTotal: valorCalculado,
              valorPago: valorPago
            };
          } else {
            console.log(`   ❌ ATACADO: VALORES INCOMPATÍVEIS! Diferença: ${Math.abs(valorPago - valorCalculado)}MT`);
            
            return {
              sucesso: false,
              tipo: 'valores_incompativeis',
              valorPago: valorPago,
              valorCalculado: valorCalculado,
              pedidos: pedidosEspecificos.pedidos,
              mensagem: `Valor pago (${valorPago}MT) não corresponde aos pedidos (${valorCalculado}MT). Verifique os valores.`
            };
          }
        }
      }
    }
    
    // MELHORAR DETECÇÃO: Verificar se é uma mensagem que contém apenas números
    const mensagemLimpa = mensagem.trim();
    const apenasNumeroRegex = /^8[0-9]{8}$/; // Exatamente um número de 9 dígitos
    const multiplosNumerosRegex = /^(8[0-9]{8}[\s,]*)+$/; // Múltiplos números separados por espaço ou vírgula
    
    console.log(`   🔍 ATACADO: Verificando se é apenas número(s)...`);
    console.log(`   📝 ATACADO: Mensagem limpa: "${mensagemLimpa}"`);
    
    if (apenasNumeroRegex.test(mensagemLimpa) || multiplosNumerosRegex.test(mensagemLimpa)) {
      console.log(`   📱 ATACADO: DETECTADO: Mensagem contém apenas número(s)!`);
      
      // Extrair números da mensagem
      const numerosDetectados = mensagemLimpa.match(/8[0-9]{8}/g) || [];
      console.log(`   📱 ATACADO: Números detectados: ${numerosDetectados.join(', ')}`);
      
      if (numerosDetectados.length > 0) {
        return await this.processarNumeros(numerosDetectados, remetente, timestamp, mensagem, configGrupo);
      }
    }
    
    // LÓGICA ORIGINAL: Separar comprovante e números
    const { textoComprovante, numeros } = this.separarComprovanteENumeros(mensagem);
    
    // 1. Verificar se é um comprovante
    let comprovante = null;
    if (textoComprovante && textoComprovante.length > 10) {
      comprovante = await this.analisarComprovante(textoComprovante);
    }
    
    // 2. Se encontrou comprovante E números na mesma mensagem
    if (comprovante && numeros.length > 0) {
      console.log(`   🎯 ATACADO: COMPROVANTE + NÚMEROS na mesma mensagem!`);
      console.log(`   💰 ATACADO: Comprovante: ${comprovante.referencia} - ${comprovante.valor}MT`);
      console.log(`   📱 ATACADO: Números: ${numeros.join(', ')}`);
      
      // Processar imediatamente como pedido completo
      if (configGrupo && parseFloat(comprovante.valor) >= 32) {
        const analiseAutomatica = await this.analisarDivisaoAutomatica(comprovante.valor, configGrupo);
        if (analiseAutomatica.deveDividir) {
          const comprovanteComDivisao = {
            referencia: comprovante.referencia,
            valor: comprovante.valor,
            timestamp: timestamp,
            fonte: comprovante.fonte,
            tipo: 'divisao_automatica',
            analiseAutomatica: analiseAutomatica
          };
          
          return await this.processarNumerosComDivisaoAutomatica(numeros, remetente, comprovanteComDivisao);
        }
      }
      
      // Processamento normal (sem divisão automática)
      if (numeros.length === 1) {
        const resultado = `${comprovante.referencia}|${comprovante.valor}|${numeros[0]}`;
        console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numeros[0]
        };
      } else {
        // Múltiplos números - dividir valor igualmente
        const valorTotal = parseFloat(comprovante.valor);
        const valorPorNumero = (valorTotal / numeros.length).toFixed(2);
        
        const resultados = numeros.map(numero => 
          `${comprovante.referencia}|${valorPorNumero}|${numero}`
        );
        
        console.log(`   ✅ ATACADO: PEDIDOS MÚLTIPLOS IMEDIATOS: ${resultados.join(' + ')}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultados.join('\n'),
          tipo: 'numeros_multiplos_processados',
          numeros: numeros,
          valorCada: valorPorNumero
        };
      }
    }
    
    // 3. Se encontrou apenas números (sem comprovante)
    if (numeros.length > 0 && !comprovante) {
      console.log(`   📱 ATACADO: Apenas números detectados: ${numeros.join(', ')}`);
      return await this.processarNumeros(numeros, remetente, timestamp, mensagem, configGrupo);
    }
    
    // 4. Se encontrou apenas comprovante (sem números)
    if (comprovante && numeros.length === 0) {
      console.log(`   💰 ATACADO: Apenas comprovante detectado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      // Analisar divisão automática
      if (configGrupo && parseFloat(comprovante.valor) >= 32) {
        const analiseAutomatica = await this.analisarDivisaoAutomatica(comprovante.valor, configGrupo);
        if (analiseAutomatica.deveDividir) {
          await this.processarComprovanteComDivisao(comprovante, remetente, timestamp, analiseAutomatica);
          return { 
            sucesso: true, 
            tipo: 'comprovante_com_divisao_automatica',
            referencia: comprovante.referencia,
            valor: comprovante.valor,
            pacotesSugeridos: analiseAutomatica.pacotes,
            divisaoCompleta: analiseAutomatica.divisaoCompleta,
            mensagem: analiseAutomatica.mensagemCliente
          };
        }
      }
      
      await this.processarComprovante(comprovante, remetente, timestamp);
      
      return { 
        sucesso: true, 
        tipo: 'comprovante_recebido',
        referencia: comprovante.referencia,
        valor: comprovante.valor,
        mensagem: '✅ *COMPROVANTE PROCESSADO!*\n\n📋 *REFERÊNCIA:* ' + comprovante.referencia + '\n💰 *VALOR:* ' + comprovante.valor + 'MT\n\n📱 Agora envie UM número para receber os megas.'
      };
    }
    
    // 5. Não reconheceu
    console.log(`   ❓ ATACADO: Mensagem não reconhecida como comprovante ou número`);
    return { 
      sucesso: false, 
      tipo: 'mensagem_nao_reconhecida',
      mensagem: null 
    };
  }

  // === ANALISAR COMPROVANTE DE TEXTO ===
  async analisarComprovante(mensagem) {
    console.log(`   🔍 ATACADO: Analisando comprovante de texto: "${mensagem}"`);
    
    const temConfirmado = /^confirmado/i.test(mensagem.trim());
    const temID = /^id\s/i.test(mensagem.trim());
    
    if (!temConfirmado && !temID) {
      console.log(`   ❌ ATACADO: Mensagem não parece ser um comprovante (não começa com "Confirmado" ou "ID")`);
      return null;
    }

    const prompt = `
Analisa esta mensagem de comprovante de pagamento M-Pesa ou E-Mola de Moçambique:

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

    try {
      const resposta = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é especialista em analisar comprovantes de pagamento moçambicanos M-Pesa e E-Mola." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      });

      console.log(`   🔍 ATACADO: Resposta da IA para comprovante: ${resposta.choices[0].message.content}`);
      
      const resultado = this.extrairJSON(resposta.choices[0].message.content);
      
      if (resultado && resultado.encontrado) {
        const comprovante = {
          referencia: resultado.referencia,
          valor: this.limparValor(resultado.valor),
          fonte: 'texto'
        };
        
        console.log(`   ✅ ATACADO: Comprovante extraído: ${comprovante.referencia} - ${comprovante.valor}MT`);
        return comprovante;
      } else {
        console.log(`   ❌ ATACADO: IA não conseguiu extrair dados do comprovante`);
        return null;
      }
    } catch (parseError) {
      console.error('❌ ATACADO: Erro ao analisar comprovante:', parseError);
      return null;
    }
  }

  // === SEPARAR COMPROVANTE E NÚMEROS ===
  separarComprovanteENumeros(mensagem, ehLegenda = false) {
    console.log(`   🔍 ATACADO: Separando comprovante e números ${ehLegenda ? '(LEGENDA)' : '(TEXTO)'}...`);
    
    if (!mensagem || typeof mensagem !== 'string') {
      console.log(`   ❌ ATACADO: Mensagem inválida para separação`);
      return { textoComprovante: '', numeros: [] };
    }
    
    // Extrair números da mensagem
    const numeros = this.extrairTodosNumeros(mensagem);
    
    // Criar texto do comprovante removendo números e contexto
    let textoComprovante = mensagem;
    
    for (const numero of numeros) {
      // Remover o número e possível contexto ao redor
      const padroes = [
        new RegExp(`\\s*megas? para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*manda para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*envia para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*enviar para\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*este\\s+número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*número\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*numero\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*comprovante\\s*${numero}\\s*`, 'gi'),
        new RegExp(`\\s*${numero}\\s*`, 'gi'), // Número no final
        new RegExp(`\\s+${numero}\\s*`, 'gi') // Número com espaços
      ];
      
      for (const padrao of padroes) {
        textoComprovante = textoComprovante.replace(padrao, ' ');
      }
    }
    
    // Limpar espaços extras
    textoComprovante = textoComprovante.replace(/\s+/g, ' ').trim();
    
    console.log(`   📄 ATACADO: Texto do comprovante: ${textoComprovante.substring(0, 50)}...`);
    console.log(`   📱 ATACADO: Números extraídos: ${numeros.join(', ')}`);
    
    return {
      textoComprovante: textoComprovante,
      numeros: numeros
    };
  }

  // === EXTRAIR TODOS OS NÚMEROS ===
  extrairTodosNumeros(mensagem) {
    if (!mensagem || typeof mensagem !== 'string') {
      return [];
    }
    
    const regexNumeros = /(?:\+258\s*)?8[0-9]{8}/g;
    const numerosEncontrados = mensagem.match(regexNumeros) || [];
    
    const numerosValidos = [];
    
    for (const numero of numerosEncontrados) {
      const numeroLimpo = this.limparNumero(numero);
      if (numeroLimpo && /^8[0-9]{8}$/.test(numeroLimpo)) {
        numerosValidos.push(numeroLimpo);
      }
    }
    
    return numerosValidos;
  }

  // === EXTRAIR JSON ===
  extrairJSON(texto) {
    try {
      // Tentativa 1: JSON direto
      return JSON.parse(texto);
    } catch (e) {
      try {
        // Tentativa 2: Remover markdown
        let limpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(limpo);
      } catch (e2) {
        try {
          // Tentativa 3: Encontrar JSON no texto
          const match = texto.match(/\{[\s\S]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (e3) {
          console.error('❌ ATACADO: Todas as tentativas de parsing falharam:', e3);
        }
      }
    }
    
    return { encontrado: false, motivo: 'parsing_failed' };
  }

  // === PROCESSAR NÚMEROS ===
  async processarNumeros(numeros, remetente, timestamp, mensagem, configGrupo) {
    console.log(`   📱 ATACADO: Processando números: ${numeros.join(', ')}`);
    
    // Buscar comprovante no histórico
    const comprovante = await this.buscarComprovanteRecenteNoHistorico(remetente, timestamp);
    
    if (comprovante) {
      const valorTotal = parseFloat(comprovante.valor);
      
      if (numeros.length === 1) {
        const resultado = `${comprovante.referencia}|${comprovante.valor}|${numeros[0]}`;
        console.log(`   ✅ ATACADO: ENCONTRADO NO HISTÓRICO: ${resultado}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultado,
          tipo: 'numero_processado',
          numero: numeros[0]
        };
      } else {
        const valorPorNumero = (valorTotal / numeros.length).toFixed(2);
        const resultados = numeros.map(numero => 
          `${comprovante.referencia}|${valorPorNumero}|${numero}`
        );
        
        console.log(`   ✅ ATACADO: ENCONTRADO NO HISTÓRICO (MÚLTIPLO): ${resultados.join(' + ')}`);
        return { 
          sucesso: true, 
          dadosCompletos: resultados.join('\n'),
          tipo: 'numeros_multiplos_processados',
          numeros: numeros,
          valorCada: valorPorNumero
        };
      }
    } else {
      console.log(`   ❌ ATACADO: Nenhum comprovante encontrado no histórico para ${remetente}`);
      return {
        sucesso: false,
        tipo: 'sem_comprovante',
        mensagem: '❌ *NENHUM COMPROVANTE ENCONTRADO!*\n\n📋 Envie primeiro o comprovante de pagamento e depois o número.'
      };
    }
  }

  // === BUSCAR COMPROVANTE RECENTE NO HISTÓRICO ===
  async buscarComprovanteRecenteNoHistorico(remetente, timestamp) {
    console.log(`   🔍 ATACADO: Buscando comprovante no histórico para ${remetente}...`);
    
    // Buscar nas mensagens dos últimos 30 minutos
    const mensagensRecentes = this.historicoMensagens.filter(msg => {
      const timeDiff = timestamp - msg.timestamp;
      return msg.remetente === remetente && 
             msg.tipo === 'texto' && 
             timeDiff <= 1800000; // 30 minutos
    });

    if (mensagensRecentes.length === 0) {
      console.log(`   ❌ ATACADO: Nenhuma mensagem recente de ${remetente} nos últimos 30 minutos`);
      return null;
    }

    console.log(`   📊 ATACADO: Analisando ${mensagensRecentes.length} mensagens dos últimos 30 minutos...`);

    for (let msg of mensagensRecentes.reverse()) {
      console.log(`   🔍 ATACADO: Verificando mensagem: "${msg.mensagem.substring(0, 50)}..."`);
      
      const comprovante = await this.analisarComprovante(msg.mensagem);
      if (comprovante) {
        const tempoDecorrido = Math.floor((timestamp - msg.timestamp) / 60000);
        console.log(`   ✅ ATACADO: Comprovante encontrado: ${comprovante.referencia} - ${comprovante.valor}MT (${tempoDecorrido} min atrás)`);
        return comprovante;
      }
    }
    
    console.log(`   ❌ ATACADO: Nenhum comprovante encontrado no histórico`);
    return null;
  }

  // === FUNÇÕES AUXILIARES (PLACEHOLDERS) ===
  async analisarPedidosEspecificos(mensagem, configGrupo) {
    // Implementação simplificada - retorna null para não interferir
    return null;
  }

  async analisarDivisaoAutomatica(valorPago, configGrupo) {
    // Implementação simplificada - retorna não deve dividir
    return { deveDividir: false, motivo: 'Divisão automática não implementada no modo atacado' };
  }

  async processarNumerosComDivisaoAutomatica(numeros, remetente, comprovanteComDivisao) {
    // Implementação simplificada
    return { sucesso: false, tipo: 'divisao_nao_implementada' };
  }

  async processarComprovanteComDivisao(comprovante, remetente, timestamp, analiseAutomatica) {
    // Implementação simplificada
    console.log(`   ⏳ ATACADO: Comprovante com divisão automática guardado`);
  }

  async processarComprovante(comprovante, remetente, timestamp) {
    this.comprovantesEmAberto[remetente] = {
      referencia: comprovante.referencia,
      valor: comprovante.valor,
      timestamp: timestamp,
      fonte: comprovante.fonte
    };
    console.log(`   ⏳ ATACADO: Comprovante guardado, aguardando número...`);
  }

  adicionarAoHistorico(mensagem, remetente, timestamp, tipo) {
    this.historicoMensagens.push({ mensagem, remetente, timestamp, tipo });
    if (this.historicoMensagens.length > this.maxHistorico) {
      this.historicoMensagens = this.historicoMensagens.slice(-this.maxHistorico);
    }
  }

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
      console.log(`🗑️ ATACADO: Removidos ${removidos} comprovantes antigos`);
    }
  }

  getStatusDetalhado() {
    return `🧠 *IA ATACADO v2.2 COMPLETA*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Processamento de imagens OTIMIZADO!\n✅ Processamento de comprovativos de TEXTO!\n✅ 2 tentativas com prompts diferentes\n✅ Correção automática de referências quebradas\n✅ Extração melhorada de JSON\n✅ Limpeza avançada de referências\n✅ Detecção de erros mais precisa\n✅ Mensagens de erro mais úteis\n✅ Suporte completo a comprovativos de texto\n✅ Análise inteligente de histórico\n\n💾 Mensagens: ${this.historicoMensagens.length}\n⏳ Comprovantes: ${Object.keys(this.comprovantesEmAberto).length}`;
  }
}

module.exports = WhatsAppAIAtacado;
