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
    
    console.log('🧠 IA WhatsApp ATACADO MELHORADA - Processamento de imagens otimizado');
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

🟡 FORMATO E-MOLA ESPECÍFICO - PADRÃO OBRIGATÓRIO:
PP + 6 dígitos + . + 4 dígitos + . + mínimo 5 caracteres
Exemplo: PP250820.1706.e9791O (PP + 250820 + . + 1706 + . + e9791O)

⚠️ CRÍTICO: Referências E-Mola seguem padrão rígido:
1. Começam com PP (2 letras)
2. Seguido de 6 dígitos (data)
3. Ponto (.)
4. Seguido de 4 dígitos (hora)  
5. Ponto (.)
6. Seguido de 5+ caracteres alfanuméricos (código único)

EXEMPLOS CORRETOS E-MOLA:
- "PP250820.1706.e9791O" (PP + 6 dígitos + 4 dígitos + 6 caracteres)
- "PP250821.1152.E58547" (PP + 6 dígitos + 4 dígitos + 6 caracteres)
- "EP240815.1420.h45672" (EP + 6 dígitos + 4 dígitos + 6 caracteres)

🚨 SE ENCONTRAR E-MOLA INCOMPLETO, PROCURE MAIS CARACTERES!
Exemplo: Se você vê "PP250820.1706.e9791" mas na linha seguinte tem "O"
RESULTADO CORRETO: "PP250820.1706.e9791O"

⚠️ CRÍTICO: MANTENHA maiúsculas e minúsculas EXATAMENTE como aparecem!

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
Para E-Mola (SEMPRE com 3 partes, terceira parte 5+ chars e CASE ORIGINAL):
{
  "referencia": "PP250820.1706.e9791O",
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
✅ "PP250820.1706.e9791O" (CORRETO - terceira parte tem 6 chars)
✅ "PP250821.1152.E58547" (CORRETO - terceira parte tem 6 chars)  
❌ "PP250820.1706.e9791" (INCOMPLETO - terceira parte tem só 5 chars)
❌ "PP250820.1706" (ERRADO - faltou a terceira parte toda)

🔍 COMO VALIDAR E-MOLA:
1. Conte os caracteres após o segundo ponto
2. Se tiver menos de 6 caracteres, PROCURE MAIS na linha seguinte
3. Junte tudo até formar a referência completa

CENÁRIO QUEBRADO COMUM:
"PP250820.1706.e9791" (linha 1) + "O" (linha 2) = "PP250820.1706.e9791O" ✅

CENÁRIO QUEBRADO COMUM:
Se você vê:
"PP250820.1706." (linha 1)
"e9791" (linha 2)
RESULTADO: "PP250820.1706.e9791" ✅

🔵 PARA M-PESA:
Se quebrado: "CHK8H3PYK" + "PE" = "CHK8H3PYKPE"

⚠️ NÃO CORTE E NÃO ALTERE MAIÚSCULAS/MINÚSCULAS! Capture EXATAMENTE como aparece!

Para E-Mola (PADRÃO: XX######.####.##### com 5+ chars na terceira parte):
{
  "referencia": "PP250820.1706.e9791O",
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
        
        // VALIDAÇÃO RIGOROSA PARA E-MOLA
        if (comprovante.tipo === 'emola') {
          const pontosCount = (comprovante.referencia.match(/\./g) || []).length;
          const partes = comprovante.referencia.split('.');
          
          console.log(`   🔍 ATACADO: Validando E-Mola: ${comprovante.referencia}`);
          console.log(`   📊 ATACADO: Partes encontradas: ${JSON.stringify(partes)}`);
          
          // Validar estrutura básica
          if (pontosCount !== 2) {
            console.log(`   ❌ ATACADO: ERRO - E-Mola deve ter exatamente 2 pontos! Encontrados: ${pontosCount}`);
          }
          
          if (partes.length !== 3) {
            console.log(`   ❌ ATACADO: ERRO - E-Mola deve ter 3 partes! Encontradas: ${partes.length}`);
          } else {
            // Validar padrão específico: PP + 6 dígitos + 4 dígitos + 5+ caracteres
            const parte1 = partes[0]; // PP250820
            const parte2 = partes[1]; // 1706
            const parte3 = partes[2]; // e9791O
            
            const prefixoOK = /^[A-Z]{2}/.test(parte1); // 2 letras no início
            const dataOK = /^\d{6}$/.test(parte1.substring(2)); // 6 dígitos após as letras
            const horaOK = /^\d{4}$/.test(parte2); // 4 dígitos
            const codigoOK = parte3.length >= 5; // Mínimo 5 caracteres
            
            console.log(`   🔍 ATACADO: Prefixo (2 letras): ${prefixoOK} - "${parte1.substring(0,2)}"`);
            console.log(`   🔍 ATACADO: Data (6 dígitos): ${dataOK} - "${parte1.substring(2)}"`);
            console.log(`   🔍 ATACADO: Hora (4 dígitos): ${horaOK} - "${parte2}"`);
            console.log(`   🔍 ATACADO: Código (5+ chars): ${codigoOK} - "${parte3}" (${parte3.length} chars)`);
            
            if (prefixoOK && dataOK && horaOK && codigoOK) {
              console.log(`   ✅ ATACADO: E-Mola com padrão CORRETO!`);
            } else {
              console.log(`   ⚠️ ATACADO: E-Mola pode estar INCOMPLETO!`);
              if (!codigoOK) {
                console.log(`   🚨 ATACADO: Terceira parte muito curta (${parte3.length} chars) - pode ter sido cortada!`);
              }
            }
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

  // === PROCESSAR TEXTO COMPLETO (RESTAURADO E MELHORADO) ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo = null) {
    console.log(`   📝 ATACADO: Analisando mensagem: "${mensagem}"`);
    
    // VERIFICAR se é apenas um número
    const mensagemLimpa = mensagem.trim();
    const apenasNumeroRegex = /^(?:\+258\s*)?8[0-9]{8}$/;
    
    if (apenasNumeroRegex.test(mensagemLimpa)) {
      const numeroLimpo = this.limparNumero(mensagemLimpa);
      console.log(`   📱 ATACADO: Detectado número isolado: ${numeroLimpo} (original: ${mensagemLimpa})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    // SEPARAR comprovante e número
    const resultado = this.separarComprovanteENumero(mensagem);
    
    // Se encontrou múltiplos números, retornar erro
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
    
    // 1. Verificar se é um comprovante
    let comprovante = null;
    if (textoComprovante && textoComprovante.length > 10) {
      comprovante = await this.analisarComprovante(textoComprovante);
    }
    
    // 2. Se encontrou comprovante E número na mesma mensagem
    if (comprovante && numero) {
      console.log(`   🎯 ATACADO: COMPROVANTE + NÚMERO na mesma mensagem!`);
      console.log(`   💰 ATACADO: Comprovante: ${comprovante.referencia} - ${comprovante.valor}MT`);
      console.log(`   📱 ATACADO: Número: ${numero}`);
      
      // CALCULAR MEGAS AUTOMATICAMENTE
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
    
    // 3. Se encontrou apenas número (sem comprovante)
    if (numero && !comprovante) {
      const numeroLimpo = this.limparNumero(numero);
      console.log(`   📱 ATACADO: Apenas número detectado: ${numeroLimpo} (original: ${numero})`);
      return await this.processarNumero(numeroLimpo, remetente, timestamp, configGrupo);
    }
    
    // 4. Se encontrou apenas comprovante (sem número)
    if (comprovante && !numero) {
      console.log(`   💰 ATACADO: Apenas comprovante detectado: ${comprovante.referencia} - ${comprovante.valor}MT`);
      
      // VERIFICAR se o valor existe na tabela
      const megasCalculados = this.calcularMegasPorValor(comprovante.valor, configGrupo);
      
      if (megasCalculados) {
        await this.processarComprovante(comprovante, remetente, timestamp);
        
        return { 
          sucesso: true, 
          tipo: 'comprovante_recebido',
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
          mensagem: `❌ *VALOR NÃO ENCONTRADO NA TABELA!*\n\n📋 *REFERÊNCIA:* ${comprovante.referencia}\n💰 *VALOR:* ${comprovante.valor}MT\n\n📋 Digite *tabela* para ver os valores disponíveis\n💡 Verifique se o valor está correto`
        };
      }
    }
    
    // 5. Não reconheceu
    console.log(`   ❓ ATACADO: Mensagem não reconhecida como comprovante ou número`);
    return { 
      sucesso: false, 
      tipo: 'mensagem_nao_reconhecida',
      mensagem: null 
    };
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
    return `🧠 *IA ATACADO v2.1 MELHORADA*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Processamento de imagens OTIMIZADO!\n✅ 2 tentativas com prompts diferentes\n✅ Correção automática de referências quebradas\n✅ Extração melhorada de JSON\n✅ Limpeza avançada de referências\n✅ Detecção de erros mais precisa\n✅ Mensagens de erro mais úteis\n\n💾 Mensagens: ${this.historicoMensagens.length}\n⏳ Comprovantes: ${Object.keys(this.comprovantesEmAberto).length}`;
  }
}

module.exports = WhatsAppAIAtacado;
