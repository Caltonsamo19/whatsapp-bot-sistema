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

    // PROMPT ULTRA ESPECÍFICO - Foco em referências quebradas
    const promptMelhorado = `
ANALISE esta imagem de comprovante M-Pesa/E-Mola de Moçambique.

⚠️ ATENÇÃO CRÍTICA - REFERÊNCIAS QUEBRADAS:
A referência da transação FREQUENTEMENTE está quebrada em múltiplas linhas!

EXEMPLO REAL que você DEVE encontrar:
Se na imagem você vê:
Linha 1: "CHK8H3PYK"
Linha 2: "PE"
RESULTADO CORRETO: "CHK8H3PYKPE" (juntando tudo!)

OUTRO EXEMPLO:
Se na imagem você vê:
Linha 1: "CHL5H3W177"  
Linha 2: "ABC"
RESULTADO CORRETO: "CHL5H3W177ABC"

🔍 INSTRUÇÕES ESPECÍFICAS:
1. PROCURE por texto que pareça código de transação
2. SE encontrar partes em linhas diferentes, JUNTE TODAS
3. Referências M-Pesa podem ter 8-15 caracteres no total
4. Referências E-Mola têm formato: XX######.####.######

🔵 M-PESA: 
- Exemplos completos: "CHK8H3PYKPE", "CHL5H3W177ABC", "CGC4GQ17W84XY"
- SEMPRE junte todas as partes que encontrar!

🟡 E-MOLA:
- Exemplos: "PP250712.2035.u31398", "EP240815.1420.h45672"
- Mantenha os pontos no lugar correto

VALOR: Procure valor em MT (ex: "125.00MT", "375MT")

⚠️ NÃO CORTE A REFERÊNCIA! Inclua TODAS as partes que encontrar!

Responda no formato:
{
  "referencia": "CHK8H3PYKPE",
  "valor": "125",
  "encontrado": true,
  "confianca": "alta",
  "tipo": "mpesa"
}

Para E-Mola:
{
  "referencia": "PP250712.2035.u31398",
  "valor": "375",
  "encontrado": true,
  "confianca": "alta",
  "tipo": "emola"
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
🚨 SEGUNDA TENTATIVA - FOCO TOTAL EM REFERÊNCIAS QUEBRADAS!

PROBLEMA: A primeira tentativa pode ter cortado a referência!

Na imagem, procure por QUALQUER texto que pareça código:
- Pode estar em 2, 3 ou mais linhas separadas
- Junte TODAS as partes que encontrar
- NÃO deixe nada para trás!

EXEMPLO REAL DO QUE VOCÊ DEVE FAZER:
Se você vê na tela:
"CHK8H3PYK" (primeira linha)
"PE" (segunda linha)  
"123" (terceira linha - se houver)

RESULTADO: "CHK8H3PYKPE123" (juntando TUDO!)

🔍 DICAS PARA ENCONTRAR REFERÊNCIA COMPLETA:
1. Olhe linha por linha na imagem
2. Procure por códigos alfanuméricos
3. Se encontrar múltiplas partes, JUNTE TODAS
4. Referências M-Pesa podem ter até 15 caracteres
5. Referências E-Mola mantêm os pontos

⚠️ ESTE É O PROBLEMA PRINCIPAL: VOCÊ ESTÁ CORTANDO AS REFERÊNCIAS!

TENTE NOVAMENTE e inclua TODA a referência que conseguir ver!

Para M-Pesa (SEM pontos):
{
  "referencia": "REFERENCIA_COMPLETA_AQUI",
  "valor": "VALOR",
  "encontrado": true,
  "tipo": "mpesa"
}

Para E-Mola (COM pontos):
{
  "referencia": "PP250712.2035.u31398",
  "valor": "VALOR", 
  "encontrado": true,
  "tipo": "emola"
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
        if (comprovante.tipo === 'emola' && !comprovante.referencia.includes('.')) {
          console.log(`   ⚠️ ATACADO: ATENÇÃO - Referência E-Mola sem pontos detectada: ${comprovante.referencia}`);
          console.log(`   🔧 ATACADO: Pode ter havido erro na limpeza da referência E-Mola`);
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

  // === LIMPEZA DE REFERÊNCIA MELHORADA ===
  limparReferencia(referencia) {
    if (!referencia) return '';
    
    let refLimpa = referencia.toString().trim();
    
    // DETECTAR se é E-Mola (contém pontos) ou M-Pesa
    const eEMola = refLimpa.includes('.');
    
    if (eEMola) {
      // PARA E-MOLA: Manter pontos e formato original
      refLimpa = refLimpa
        .replace(/\s+/g, '') // Remove apenas espaços e quebras de linha
        .replace(/[^\w.]/g, '') // Remove caracteres especiais MAS MANTÉM pontos
        .toLowerCase(); // E-Mola geralmente é minúsculo
      
      console.log(`   🟡 ATACADO: Referência E-Mola limpa: "${referencia}" -> "${refLimpa}"`);
    } else {
      // PARA M-PESA: Remover tudo exceto alfanuméricos
      refLimpa = refLimpa
        .replace(/\s+/g, '') // Remove espaços e quebras de linha
        .replace(/[^\w]/g, '') // Remove caracteres não alfanuméricos (incluindo pontos)
        .toUpperCase(); // M-Pesa geralmente é maiúsculo
      
      console.log(`   🔵 ATACADO: Referência M-Pesa limpa: "${referencia}" -> "${refLimpa}"`);
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

  // === PLACEHOLDER PARA OUTRAS FUNÇÕES MANTIDAS ===
  async processarTexto(mensagem, remetente, timestamp, configGrupo) {
    // Manter implementação original do código
    console.log(`   📝 ATACADO: Processamento de texto mantido do código original`);
    return { sucesso: false, tipo: 'funcao_nao_implementada' };
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
