const { OpenAI } = require("openai");

class WhatsAppAIAtacado {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.comprovantesEmAberto = {};
    this.historicoMensagens = [];
    this.maxHistorico = 100;
    
    // === OTIMIZAÇÃO: Cache de resultados para reduzir tokens ===
    this.cacheResultados = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos (reduzido para evitar confusão)
    this.tokenStats = {
      total: 0,
      saved: 0,
      calls: 0,
      cacheHits: 0
    };

    
    // INICIALIZAR SISTEMA DE CONTROLE DE REFERÊNCIAS
    this.referencias_processadas = new Map();
    
    setInterval(() => {
      this.limparComprovantesAntigos();
      this.limparCacheAntigo(); // OTIMIZAÇÃO: Limpar cache junto
      this.limparReferenciasAntigas(); // NOVO: Limpar referências antigas
    }, 5 * 60 * 1000); // Reduzido para 5 minutos para limpeza mais frequente
    
    console.log('🧠 IA WhatsApp ATACADO v5.0 inicializada - Processamento apenas de texto');
  }

  // === RECONSTRUÇÃO BREVE DE REFERÊNCIAS ===
  reconstruirReferenciasBreve(texto) {
    console.log('🔧 Reconstrução breve...');

    // Apenas os padrões mais comuns
    const padroes = [
      // M-Pesa quebrado em 2 linhas
      /(\w{6,10})\s*\n\s*(\w{1,5})/g,
      // E-Mola básico: PP + números quebrados
      /(PP\d{6})\.\s*(\d{4})\.\s*([A-Za-z]\d{5})/g,
      // Espaços extras
      /\s{2,}/g
    ];

    let textoLimpo = texto;

    // M-Pesa: juntar fragmentos
    textoLimpo = textoLimpo.replace(padroes[0], '$1$2');

    // E-Mola: corrigir pontos
    textoLimpo = textoLimpo.replace(padroes[1], '$1.$2.$3');

    // Limpar espaços extras
    textoLimpo = textoLimpo.replace(padroes[2], ' ');

    console.log(`✅ ${textoLimpo.length - texto.length} chars ajustados`);
    return textoLimpo;
  }

  // === RECONSTRUIR REFERÊNCIAS QUEBRADAS (VERSÃO ROBUSTA - DESATIVADA) ===
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
          
          // Tentar extrair referência alternativa do texto original
          const referenciaAlternativa = this.buscarReferenciaAlternativa(textoExtraido);
          if (referenciaAlternativa) {
            console.log(`🔄 Usando referência alternativa: "${referenciaAlternativa}"`);
            resultado.referencia = referenciaAlternativa;
          } else {
            console.log(`❌ Nenhuma referência válida encontrada`);
            resultado.encontrado = false;
          }
        } else {
          console.log(`✅ Referência validada: ${resultado.referencia} (${validacao.tipo})`);
          // MÉTRICAS: Referência validada
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
            // VERIFICAR SE É MEGAS (APENAS MEGAS PODE SER SUBDIVIDIDO)
            if (megasCalculados.tipo === 'megas') {
              // NOVA LÓGICA: SEMPRE aplicar subdivisão se necessário (>10GB)
              const pedidosFinais = this.aplicarSubdivisaoSeNecessario(
                comprovante.referencia,
                megasCalculados.megas,
                numeros[0]
              );

              console.log(`   ✅ ATACADO: PEDIDO MEGAS COMPLETO (IMAGEM + LEGENDA): ${pedidosFinais.length} bloco(s)`);
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
                metodo: comprovante.metodo,
                tipoProduto: 'megas'
              };
            } else {
              // É SALDO - NÃO PRECISA SUBDIVISÃO
              const numeroLimpo = this.limparNumero(numeros[0]);
              const resultado = `${comprovante.referencia}|${megasCalculados.saldo}|${numeroLimpo}`;

              console.log(`   ✅ ATACADO: PEDIDO SALDO COMPLETO (IMAGEM + LEGENDA): ${resultado}`);

              return {
                sucesso: true,
                dadosCompletos: resultado,
                tipo: 'saldo_processado',
                numero: numeros[0],
                saldo: megasCalculados.saldo,
                subdividido: false,
                fonte: 'imagem_com_legenda',
                metodo: comprovante.metodo,
                tipoProduto: 'saldo'
              };
            }

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
          // Múltiplos números detectados - ENCAMINHAR PARA BOT DE DIVISÃO (DOS EXEMPLOS)
          console.log(`   🔄 ATACADO: Múltiplos números detectados (${numeros.length}) - Encaminhando para bot de divisão`);
          console.log(`   📱 NÚMEROS: ${numeros.join(', ')}`);
          console.log(`   💰 COMPROVANTE: ${comprovante.referencia} - ${comprovante.valor}MT`);

          return {
            sucesso: false,
            tipo: 'multiplos_numeros_nao_permitido',
            numeros: numeros,
            comprovativo: comprovante,
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
        metodo: comprovante.metodo,
        tipoProduto: megasCalculados.tipo,
        ...(megasCalculados.tipo === 'megas' ? { megas: megasCalculados.megas } : { saldo: megasCalculados.saldo }),
        mensagem: megasCalculados.tipo === 'megas'
          ? `Comprovante da imagem processado! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}MB. Agora envie UM número que vai receber os megas.`
          : `Comprovante da imagem processado! Valor: ${comprovante.valor}MT = ${megasCalculados.saldo}MT saldo. Agora envie UM número que vai receber o saldo.`
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

  // === CALCULAR MEGAS OU SALDO POR VALOR (SISTEMA DUAL) ===
  calcularMegasPorValor(valorPago, configGrupo) {
    console.log(`   🧮 ATACADO: Calculando produto para valor ${valorPago}MT (SISTEMA DUAL: MEGAS → SALDO)...`);
    console.log(`   🔍 DEBUG: Tipo de valorPago: ${typeof valorPago}, Valor: "${valorPago}"`);

    if (!configGrupo) {
      console.log(`   ❌ ATACADO: Configuração do grupo não disponível`);
      return null;
    }

    // 1. PRIMEIRO: Tentar MEGAS
    if (configGrupo.precos) {
      console.log(`   🔧 ATACADO: Verificando tabela de MEGAS primeiro...`);
      const resultadoMegas = this.calcularMegasPorValorDireto(valorPago, configGrupo.precos);
      if (resultadoMegas) {
        console.log(`   ✅ ATACADO: VALOR ENCONTRADO NA TABELA DE MEGAS!`);
        return {
          ...resultadoMegas,
          tipo: 'megas'
        };
      }
      console.log(`   ❌ ATACADO: Valor ${valorPago}MT não existe na tabela de megas`);
    }

    // 2. SEGUNDO: Tentar SALDO
    if (configGrupo.precosSaldo) {
      console.log(`   🔧 ATACADO: Verificando tabela de SALDO...`);
      const resultadoSaldo = this.calcularSaldoPorValor(valorPago, configGrupo.precosSaldo);
      if (resultadoSaldo) {
        console.log(`   ✅ ATACADO: VALOR ENCONTRADO NA TABELA DE SALDO!`);
        return {
          ...resultadoSaldo,
          tipo: 'saldo'
        };
      }
      console.log(`   ❌ ATACADO: Valor ${valorPago}MT não existe na tabela de saldo`);
    } else {
      console.log(`   ⚠️ ATACADO: Grupo não tem tabela de saldo configurada`);
    }

    // 3. FALLBACK: Método original (se existe)
    if (configGrupo.precos) {
      console.log(`   🔧 ATACADO: Usando configuração de preços diretos do bot divisão (fallback)`);
      console.log(`   🔍 DEBUG: Passando valorPago: "${valorPago}" para calcularMegasPorValorDireto`);
      const resultado = this.calcularMegasPorValorDireto(valorPago, configGrupo.precos);
      if (resultado) {
        return {
          ...resultado,
          tipo: 'megas'
        };
      }
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

  // === CALCULAR SALDO POR VALOR (VALIDAÇÃO RIGOROSA - SEM TOLERÂNCIA) ===
  calcularSaldoPorValor(valorPago, precosSaldo) {
    console.log(`   🧮 ATACADO: Calculando saldo com preços diretos para valor ${valorPago}MT (VALIDAÇÃO RIGOROSA)...`);
    console.log(`   🔍 DEBUG SALDO: Tipo de valorPago: ${typeof valorPago}, Valor recebido: "${valorPago}"`);
    console.log(`   📋 ATACADO: Preços de saldo disponíveis:`, Object.entries(precosSaldo).map(([saldo, preco]) => `${saldo}MT=${preco}MT`).join(', '));

    const valorNumerico = parseFloat(valorPago);
    console.log(`   🔍 DEBUG SALDO: valorNumerico após parseFloat: ${valorNumerico}`);

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      console.log(`   ❌ ATACADO: Valor inválido para cálculo de saldo: ${valorPago}`);
      return null;
    }

    // Buscar valor EXATO na tabela de saldo
    for (const [saldo, preco] of Object.entries(precosSaldo)) {
      if (preco === valorNumerico) {
        console.log(`   ✅ ATACADO: Preço EXATO encontrado na tabela de saldo: ${valorNumerico}MT = ${saldo}MT saldo`);
        return {
          saldo: parseInt(saldo),
          valorPago: valorNumerico,
          found: true
        };
      }
    }

    console.log(`   ❌ ATACADO: Valor ${valorNumerico}MT não encontrado na tabela de saldo`);
    console.log(`   📋 ATACADO: Valores válidos:`, Object.values(precosSaldo).join('MT, ') + 'MT');
    return null;
  }

  // === FUNÇÃO AUXILIAR PARA PROCESSAR RESULTADOS DUAL (MEGAS OU SALDO) ===
  processarResultadoDual(produto, referencia, numero) {
    if (!produto) return null;

    const numeroLimpo = this.limparNumero(numero);

    if (produto.tipo === 'saldo') {
      const resultado = `${referencia}|${produto.saldo}|${numeroLimpo}`;
      console.log(`   ✅ ATACADO: PEDIDO SALDO COMPLETO: ${resultado}`);
      return {
        sucesso: true,
        dadosCompletos: resultado,
        tipo: 'saldo_processado',
        numero: numeroLimpo,
        saldo: produto.saldo,
        valorPago: produto.valorPago,
        tipoProduto: 'saldo'
      };
    } else {
      // Manter formato original para megas
      const resultado = `${referencia}|${produto.megas}|${numeroLimpo}`;
      console.log(`   ✅ ATACADO: PEDIDO MEGAS COMPLETO: ${resultado}`);
      return {
        sucesso: true,
        dadosCompletos: resultado,
        tipo: 'numero_processado',
        numero: numeroLimpo,
        megas: produto.megas,
        valorPago: produto.valorPago,
        tipoProduto: 'megas'
      };
    }
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

  // === VALIDAR VALOR CONTRA TABELA (VALIDAÇÃO RIGOROSA - SISTEMA DUAL) ===
  validarValorContraTabela(valorPago, configGrupo) {
    console.log(`   🔍 VALIDAÇÃO RIGOROSA: Verificando se valor ${valorPago}MT está na tabela (DUAL: megas + saldo)...`);

    if (!configGrupo) {
      console.log(`   ❌ VALIDAÇÃO: Configuração do grupo não disponível`);
      return {
        valido: false,
        motivo: 'Configuração do grupo não disponível',
        valoresValidos: [],
        tipoProduto: null
      };
    }

    let valoresValidosMegas = [];
    let valoresValidosSaldo = [];

    // 1. VERIFICAR TABELA DE MEGAS
    if (configGrupo.precos) {
      valoresValidosMegas = Object.values(configGrupo.precos).map(p => parseInt(p)).sort((a, b) => a - b);
      console.log(`   📊 VALIDAÇÃO: Valores válidos MEGAS: ${valoresValidosMegas.map(v => `${v}MT`).join(', ')}`);
    }

    // 2. VERIFICAR TABELA DE SALDO
    if (configGrupo.precosSaldo) {
      valoresValidosSaldo = Object.values(configGrupo.precosSaldo).map(p => parseInt(p)).sort((a, b) => a - b);
      console.log(`   💰 VALIDAÇÃO: Valores válidos SALDO: ${valoresValidosSaldo.map(v => `${v}MT`).join(', ')}`);
    }

    // 3. EXTRAIR DE TABELA TEXTO (FALLBACK)
    if (valoresValidosMegas.length === 0 && valoresValidosSaldo.length === 0 && configGrupo.tabela) {
      console.log(`   📋 VALIDAÇÃO: Extraindo preços da tabela texto...`);
      const precos = this.extrairPrecosTabela(configGrupo.tabela);
      valoresValidosMegas = precos.map(p => p.preco).sort((a, b) => a - b);
    }

    // 4. VERIFICAR SE PELO MENOS UMA TABELA EXISTE
    if (valoresValidosMegas.length === 0 && valoresValidosSaldo.length === 0) {
      console.log(`   ❌ VALIDAÇÃO: Nem preços de megas nem saldo disponíveis`);
      return {
        valido: false,
        motivo: 'Nenhuma tabela de preços configurada',
        valoresValidos: [],
        tipoProduto: null
      };
    }

    const valorNumerico = parseFloat(valorPago);

    // 5. VERIFICAR EM MEGAS PRIMEIRO
    if (valoresValidosMegas.includes(valorNumerico)) {
      console.log(`   ✅ VALIDAÇÃO: Valor ${valorPago}MT APROVADO - encontrado na tabela de MEGAS`);
      return {
        valido: true,
        valor: valorNumerico,
        valoresValidos: [...valoresValidosMegas, ...valoresValidosSaldo].sort((a, b) => a - b),
        tipoProduto: 'megas'
      };
    }

    // 6. VERIFICAR EM SALDO DEPOIS
    if (valoresValidosSaldo.includes(valorNumerico)) {
      console.log(`   ✅ VALIDAÇÃO: Valor ${valorPago}MT APROVADO - encontrado na tabela de SALDO`);
      return {
        valido: true,
        valor: valorNumerico,
        valoresValidos: [...valoresValidosMegas, ...valoresValidosSaldo].sort((a, b) => a - b),
        tipoProduto: 'saldo'
      };
    }

    // 7. VALOR NÃO ENCONTRADO EM NENHUMA TABELA
    const todosValores = [...valoresValidosMegas, ...valoresValidosSaldo].sort((a, b) => a - b);
    console.log(`   ❌ VALIDAÇÃO: Valor ${valorPago}MT REJEITADO - NÃO encontrado em nenhuma tabela`);
    console.log(`   📋 VALIDAÇÃO: Valores válidos combinados: ${todosValores.map(v => `${v}MT`).join(', ')}`);

    return {
      valido: false,
      motivo: `Valor ${valorPago}MT não está na tabela de preços`,
      valorInvalido: valorNumerico,
      valoresValidos: todosValores,
      tipoProduto: null
    };
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
      console.log(`🔄 ATACADO: Múltiplos números na mensagem - preparando para encaminhar`);
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
        return {
          sucesso: false,
          tipo: 'processamento_imagem_removido',
          mensagem: '❌ Processamento de imagens desativado\n📄 Solicitamos que o comprovante seja enviado em formato de texto.\n\nℹ️ Esta medida foi adotada para garantir que o sistema funcione de forma mais rápida, estável e com menos falhas.'
        };
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
      
      const produtoCalculado = this.calcularMegasPorValor(comprovante.valor, configGrupo);

      if (produtoCalculado) {
        const resultado = this.processarResultadoDual(produtoCalculado, comprovante.referencia, numero);
        if (resultado) {
          resultado.valorPago = comprovante.valor;
          console.log(`   ✅ ATACADO: PEDIDO COMPLETO IMEDIATO (${produtoCalculado.tipo}): ${resultado.dadosCompletos}`);
          return resultado;
        }
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
          tipoProduto: megasCalculados.tipo,
          ...(megasCalculados.tipo === 'megas' ? { megas: megasCalculados.megas } : { saldo: megasCalculados.saldo }),
          mensagem: megasCalculados.tipo === 'megas'
            ? `Comprovante recebido! Valor: ${comprovante.valor}MT = ${megasCalculados.megas}MB. Agora envie UM número que vai receber os megas.`
            : `Comprovante recebido! Valor: ${comprovante.valor}MT = ${megasCalculados.saldo}MT saldo. Agora envie UM número que vai receber o saldo.`
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
    console.log(`🔍 VALIDAÇÃO SIMPLIFICADA: Verificando apenas referências válidas...`);

    // VALIDAÇÃO SIMPLIFICADA - Apenas verificar se há referências válidas
    const refsValidas = [];

    // Procurar M-Pesa válidas (11 chars alfanuméricos)
    const mpesaValidas = texto.match(/\b[A-Z0-9]{11}\b/g);
    if (mpesaValidas) {
      mpesaValidas.forEach(ref => {
        if (/[A-Z]/.test(ref) && /[0-9]/.test(ref)) {
          refsValidas.push({ tipo: 'M-Pesa', referencia: ref });
        }
      });
    }

    // Procurar E-Mola válidas (PP + padrão completo)
    const emolaValidas = texto.match(/PP\d{6}\.\d{4}\.[A-Za-z]\d{5}/g);
    if (emolaValidas) {
      emolaValidas.forEach(ref => {
        refsValidas.push({ tipo: 'E-Mola', referencia: ref });
      });
    }
    
    // Log das referências válidas encontradas
    if (refsValidas.length > 0) {
      console.log(`   📋 M-Pesa válidas encontradas: ${refsValidas.filter(r => r.tipo === 'M-Pesa').map(r => r.referencia).join(', ')}`);
      console.log(`   📋 E-Mola válidas encontradas: ${refsValidas.filter(r => r.tipo === 'E-Mola').map(r => r.referencia).join(', ')}`);
    }

    console.log(`✅ VALIDAÇÃO SIMPLIFICADA: ${refsValidas.length} referência(s) válida(s) encontrada(s)`);

    return {
      completo: refsValidas.length > 0,
      referenciasCompletas: refsValidas.length,
      referenciasEncontradas: {
        mPesa: refsValidas.filter(r => r.tipo === 'M-Pesa').map(r => r.referencia),
        eMola: refsValidas.filter(r => r.tipo === 'E-Mola').map(r => r.referencia)
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
      return resultado2;
    }
    
    // ABORDAGEM 3: Prompt simplificado para GPT
    console.log(`🔧 Tentativa 3: Prompt simplificado`);
    const resultado3 = await this.interpretarComPromptSimplificado(textoExtraido);
    if (resultado3.encontrado) {
      console.log(`✅ Abordagem 3 funcionou!`);
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
    
    // Padrões de valor CORRIGIDOS (priorizar "Transferiste")
    const padroesValor = [
      // PRIORIDADE: Padrão específico "Transferiste" (para evitar capturar taxa)
      /Transferiste\s+(\d+(?:[.,]\d{1,2})?)MT/gi,
      // Padrões genéricos como fallback
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
        delete this.comprovantesEmAberto[remetente];

        // Usar função auxiliar para processar resultado dual
        const resultadoProcessado = this.processarResultadoDual(megasCalculados, comprovante.referencia, numero);
        if (resultadoProcessado) {
          resultadoProcessado.valorPago = comprovante.valor;
          resultadoProcessado.origem = 'comprovante_em_aberto';
          console.log(`   ✅ ATACADO: PEDIDO COMPLETO (${megasCalculados.tipo}): ${resultadoProcessado.dadosCompletos}`);
          return resultadoProcessado;
        }
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
        // Usar função auxiliar para processar resultado dual
        const resultadoProcessado = this.processarResultadoDual(megasCalculados, comprovante.referencia, numero);
        if (resultadoProcessado) {
          resultadoProcessado.valorPago = comprovante.valor;
          resultadoProcessado.origem = 'historico';
          console.log(`   ✅ ATACADO: ENCONTRADO NO HISTÓRICO (${megasCalculados.tipo}): ${resultadoProcessado.dadosCompletos}`);
          return resultadoProcessado;
        }
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
      
      // BUSCAR VALOR: Padrão SIMPLES e EFICAZ (dos exemplos)
      const valorMatch = mensagem.match(/Transferiste\s+(\d+(?:\.\d+)?)MT/i);
      if (valorMatch) {
        valor = this.limparValor(valorMatch[1]);
        console.log(`✅ Valor encontrado: ${valorMatch[1]} → ${valor}MT`);
      }
      
      if (referencia && valor && valor !== null && valor !== undefined) {
        const valorLimpo = this.limparValor(valor);

        // VALIDAÇÃO ADICIONAL: Garantir que valor não seja undefined/null após limpeza
        if (!valorLimpo || valorLimpo === '0' || valorLimpo === 'undefined' || valorLimpo === 'null') {
          console.error(`❌ ATACADO: Valor limpo inválido: original="${valor}" → limpo="${valorLimpo}"`);
          return null;
        }

        console.log(`🎯 ATACADO: Extração DIRETA ROBUSTA - Ref:${referencia} Valor:${valorLimpo}MT`);
        
        // ======= VALIDAÇÃO RIGOROSA DE VALOR =======
        let tipoProdutoDetectado = null;
        if (configGrupo) {
          const validacao = this.validarValorContraTabela(valorLimpo, configGrupo);
          if (!validacao.valido) {
            console.log(`❌ VALIDAÇÃO RIGOROSA: Valor ${valorLimpo}MT REJEITADO - ${validacao.motivo}`);
            return {
              encontrado: false,
              valor: valorLimpo, // CORREÇÃO: Incluir o valor mesmo quando há validação rigorosa inválida
              valor_invalido: valorLimpo,
              referencia: referencia,
              motivo: 'valor_nao_esta_na_tabela',
              valores_validos: validacao.valoresValidos,
              mensagem_erro: `❌ *VALOR INVÁLIDO!*\n\n📋 *REFERÊNCIA:* ${referencia}\n💰 *VALOR ENVIADO:* ${valorLimpo}MT\n\n⚠️ Este valor não está na nossa tabela de preços.\n\n📋 *VALORES VÁLIDOS:*\n${validacao.valoresValidos.map(v => `• ${v}MT`).join('\n')}\n\n💡 Digite *tabela* para ver todos os pacotes disponíveis.`
            };
          }
          tipoProdutoDetectado = validacao.tipoProduto;
          console.log(`✅ VALIDAÇÃO RIGOROSA: Valor ${valorLimpo}MT APROVADO - Tipo: ${tipoProdutoDetectado?.toUpperCase() || 'DESCONHECIDO'}`);
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
            valor: valorLimpo, // CORREÇÃO: Incluir o valor mesmo quando há inconsistências
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
          fonte: 'regex_direto_robusto',
          tipoProduto: tipoProdutoDetectado
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

        // VALIDAÇÃO ROBUSTA DO VALOR DA IA
        if (!valorLimpo || valorLimpo === '0' || valorLimpo === 'undefined' || valorLimpo === 'null') {
          console.error(`❌ ATACADO: Valor inválido extraído via IA: "${resultado.valor}" → "${valorLimpo}"`);
          return null;
        }

        // ======= VALIDAÇÃO RIGOROSA DE VALOR (IA) =======
        let tipoProdutoDetectadoIA = null;
        if (configGrupo) {
          const validacao = this.validarValorContraTabela(valorLimpo, configGrupo);
          if (!validacao.valido) {
            console.log(`❌ VALIDAÇÃO RIGOROSA (IA): Valor ${valorLimpo}MT REJEITADO - ${validacao.motivo}`);
            const resultadoInvalido = {
              encontrado: false,
              valor: valorLimpo, // CORREÇÃO: Incluir o valor mesmo quando há validação inválida na IA
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
          tipoProdutoDetectadoIA = validacao.tipoProduto;
          console.log(`✅ VALIDAÇÃO RIGOROSA (IA): Valor ${valorLimpo}MT APROVADO - Tipo: ${tipoProdutoDetectadoIA?.toUpperCase() || 'DESCONHECIDO'}`);
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
          fonte: 'texto',
          tipoProduto: tipoProdutoDetectadoIA
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

  // === NORMALIZAR VALOR ROBUSTO (MELHORADO) ===
  normalizarValorRobusto(valor) {
    if (typeof valor === 'number') {
        return valor;
    }

    if (typeof valor === 'string') {
        let valorLimpo = valor.trim();

        // Casos especiais: valores com múltiplos zeros após vírgula (ex: "1,0000" = 1000MT)
        // Padrão: número seguido de vírgula e só zeros
        const regexZerosAposVirgula = /^(\d+),0+$/;
        const matchZeros = valorLimpo.match(regexZerosAposVirgula);
        if (matchZeros) {
            // "1,0000" significa 1000 meticais (vírgula + zeros = multiplicador de milhares)
            const baseNumero = parseInt(matchZeros[1]);
            const numeroZeros = valorLimpo.split(',')[1].length;
            // Para "1,0000": base=1, zeros=4, então 1 * 1000 = 1000
            const multiplicador = numeroZeros >= 3 ? 1000 : Math.pow(10, numeroZeros);
            return baseNumero * multiplicador;
        }

        // Detectar se vírgula é separador de milhares ou decimal
        const temVirgulaSeguida3Digitos = /,\d{3}($|\D)/.test(valorLimpo);

        if (temVirgulaSeguida3Digitos) {
            // Vírgula como separador de milhares: "1,000" ou "10,500.50"
            valorLimpo = valorLimpo.replace(/,(?=\d{3}($|\D))/g, '');
        } else {
            // Vírgula como separador decimal: "1,50" → "1.50"
            valorLimpo = valorLimpo.replace(',', '.');
        }

        const valorNumerico = parseFloat(valorLimpo);

        if (isNaN(valorNumerico)) {
            console.warn(`⚠️ ATACADO: Valor não pôde ser normalizado: "${valor}"`);
            return null;
        }

        // Retorna inteiro se não tem decimais significativos
        return (Math.abs(valorNumerico % 1) < 0.0001) ? Math.round(valorNumerico) : valorNumerico;
    }

    return null;
  }

  // === LIMPAR VALOR MONETÁRIO (SIMPLES E EFICAZ - DOS EXEMPLOS) ===
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
    const timeout = 15 * 60 * 1000; // Reduzido para 15 minutos
    let removidos = 0;

    Object.keys(this.comprovantesEmAberto).forEach(remetente => {
      const comprovante = this.comprovantesEmAberto[remetente];
      if (agora - comprovante.timestamp > timeout) {
        delete this.comprovantesEmAberto[remetente];
        removidos++;
      }
    });

    if (removidos > 0) {
      console.log(`🗑️ ATACADO: Removidos ${removidos} comprovantes antigos (>15min)`);
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
    const umaHora = 1 * 60 * 60 * 1000; // 1 hora (reduzido para evitar confusão)
    let removidas = 0;

    for (const [referencia, timestamp] of this.referencias_processadas.entries()) {
      if (agora - timestamp > umaHora) {
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

    // CORREÇÃO: Subdividir em blocos EXATOS de 10GB
    const pedidosSubdivididos = [];
    let megasRestantes = megasTotal;
    let contadorBloco = 1;

    console.log(`   🔧 ATACADO: ${Math.floor(megasTotal/1024)}GB → Criando blocos de EXATAMENTE 10GB`);

    // Criar blocos de exatamente 10GB
    while (megasRestantes > 0) {
      const megasBloco = megasRestantes >= 10240 ? 10240 : megasRestantes;

      const novaReferencia = referenciaBase + String(contadorBloco);
      const pedidoSubdividido = `${novaReferencia}|${megasBloco}|${numero}`;

      pedidosSubdivididos.push(pedidoSubdividido);

      console.log(`      📦 ATACADO: Bloco ${contadorBloco}: ${novaReferencia} - ${Math.floor(megasBloco/1024)}GB (${megasBloco}MB)`);

      megasRestantes -= megasBloco;
      contadorBloco++;
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
