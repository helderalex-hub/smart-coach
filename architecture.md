# Aetheris — Arquitetura do Sistema e Motor de Treinamento Adaptativo

O **Aetheris** é uma plataforma de prescrição de treinamento adaptativo para atletas de corrida, fundamentada em fisiologia do exercício, análise de carga externa/interna e variabilidade da frequência cardíaca (VFC). 

Este documento apresenta a arquitetura atualizada, detalhando a separação de responsabilidades entre a experiência simplificada do atleta, o motor matemático de prontidão e os módulos de telemetria e prescrição.

---

## 1. Visão Geral da Arquitetura

O Aetheris adota a arquitetura **Clean UI & Isolated Domain Engine**, separando rigorosamente as decisões da interface do usuário das regras fisiológicas puras.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AETHERIS FRONTEND (REACT)                       │
├──────────────┬───────────────┬────────────────┬───────────────┬────────┤
│  Briefing    │  Disponibi-   │  Prescrição    │ Telemetria &  │ Audit  │
│  do Atleta   │  lidade Hoje  │  Ajustada      │ Análise FIT   │ Modal  │
└──────┬───────┴───────┬───────┴────────┬───────┴───────┬───────┴───┬────┘
       │               │                │               │           │
       ▼               ▼                ▼               ▼           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    COACH ENGINE (MOTOR PURO TYPESCRIPT)                │
├────────────────────────────────────────────────────────────────────────┤
│ • Readiness Engine (Prontidão Fisiológica Diária)                      │
│ • Carga Acumulada EWMA (ATL / CTL / ACWR)                              │
│ • Análise de Microciclo (Monotonia & Strain de Foster)                 │
│ • Prescrição Adaptativa & Explicabilidade Fisiológica                  │
│ • Exportador de Treinos Estruturados para Garmin Connect               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Princípio do Design de Interface: Briefing em Primeira Camada

A interface do Aetheris foi projetada para evitar a sobrecarga de informações numéricas ou jargões laboratoriais para o atleta no dia a dia, reservando dados complexos para modais de auditoria técnica.

### 2.1. O Briefing Diário
Ao abrir o painel, o atleta visualiza imediatamente uma síntese direta de 5 elementos essenciais:

1. **Disponibilidade de Treino (ex.: `42/100`):** Mede a capacidade biológica do dia para absorção de carga.
   * *Nota de Design:* O rótulo "Disponibilidade de Treino" substitui o termo "Preparação" para evitar a falsa interpretação de que o número indica percentual de condicionamento físico geral do atleta.
2. **Decisão do Dia (Hoje):** Status direto com símbolo visual rápido:
   * 🟢 **Treino Mantido**
   * 🟡 **Ajuste de Carga**
   * 🔴 **Recuperação Ativa**
3. **Treino Prescrito:** Duração e tipo do treino ajustado (ex.: `25 minutos leve`).
4. **Por quê? (Justificativa Humana):** Explicação simples, contextual e sem jargões como "depuração metabólica" (ex.: *"Seu sono foi reduzido e você relatou cansaço. Vamos recuperar hoje para treinar melhor amanhã"*).
5. **Confiança da Decisão:** Nível de confiabilidade (*Alta / Moderada / Básica*) calculado a partir da quantidade e consistência dos dados biométricos preenchidos.

### 2.2. Transparência Gradual (Ver Análise Avançada)
Se o atleta ou o treinador desejar examinar os bastidores científicos, um botão dedicado aciona o **Modal de Análise Avançada**, expondo a matriz matemática completa:
* Fórmula de ponderação do score de prontidão
* Gráfico e valores de VFC (HRV) em relação à linha de base
* Cálculo da razão de carga de trabalho aguda/crônica (ACWR) via EWMA
* Indicadores de Monotonia e Carga de Estresse (Strain) de Foster

---

## 3. Motor de Prontidão Fisiológica (Readiness Engine)

O motor calcula a capacidade do organismo de responder positivamente ao estresse do treino no dia corrente.

### 3.1. Ponderação Científica sem Dupla Contagem (Base 100%)

Para evitar a sobreposição de métricas correlacionadas (como o Body Battery da Garmin, que já internaliza HRV e sono), o Aetheris distribui os pesos da seguinte forma:

| Indicador | Peso (%) | Métrica Analisada | Justificativa Fisiológica |
|---|---|---|---|
| **Sono Total** | **40%** | Horas de sono (20%) + Sleep Score (20%) | Restauração neuroendócrina e recuperação celular primária |
| **Percepção Subjetiva** | **20%** | Escala de disposição (1 a 5) | Resposta integrada do Sistema Nervoso Central (SNC) |
| **VFC / HRV** | **15%** | Desvio em relação à baseline de 21 dias | Tônus parassimpático e moduladores do estresse autônomo |
| **Body Battery** | **15%** | Nível de reserva (0-100%) | Leitura integrativa do estado energético do dispositivo |
| **Dor Muscular** | **10%** | Escala visual de dor (1-10) | Integridade tecidual e risco de estiramento miofascial |

### 3.2. Teto de Penalização Proporcional (-25 pts)
Se múltiplos estressores agudos coincidirem (ex.: sono restrito + dor muscular elevada + VFC desequilibrada), a soma das penalidades brutas é limitada a um **teto de -25 pontos**, impedindo scores irracionais (zerados) e mantendo a sensibilidade fisiológica.

### 3.3. Capacidade Estimada por Modalidade
A interface traduz o score numérico em orientações qualitativas acionáveis por tipo de treino, evitando percentuais de falsa precisão matemática:

* **Mobilidade & Core:** 🟢 Liberada
* **Rodagem Leve (Z2):** 🟢 Liberada / 🟢 Permitida com ajuste
* **Tempo Run / Limiar:** 🟡 Adiar / 🔴 Evitar hoje
* **Intervalados / Tiros:** 🔴 Evitar hoje

---

## 4. Modelo de Carga de Treino: EWMA & Análise de Microciclo

### 4.1. Decaimento Exponencial Movel (EWMA)
Em vez de taxas fixas de redução linear, o Aetheris adota o modelo **EWMA (Exponentially Weighted Moving Average)** para espelhar o decaimento assintótico da fadiga biológica:

* **ATL (Fadiga Aguda - 7 dias):** Constante de tempo $\alpha = 0.20$.
  Em dias de descanso:
  $$\text{ATL}_{\text{hoje}} = \text{ATL}_{\text{ontem}} \times (1 - 0.20)^d$$
  *(onde $d$ é o número de dias sem treino)*

* **CTL (Aptidão Crônica - 28 a 42 dias):** Constante de tempo $\alpha = 0.07$.
  Representa a base estrutural acumulada pelo atleta.

* **ACWR (Acute-to-Chronic Workload Ratio):**
  $$\text{ACWR} = \frac{\text{ATL}}{\text{CTL}}$$
  * **0.8 a 1.3:** Faixa ótima de carga (Sweet Spot)
  * **> 1.3:** Carga elevada / Atencioso para sobrecarga
  * **> 1.5:** Zona de perigo de lesão

### 4.2. Monotonia e Estresse do Microciclo (Foster)
O monitoramento da variabilidade semanal previne a adaptação negativa e o overtraining:

$$\text{Monotonia} = \frac{\text{Média da Carga Diária}}{\text{Desvio Padrão da Carga Diária}}$$

$$\text{Strain (Estresse)} = \text{Carga Semanal Total} \times \text{Monotonia}$$

* **Monotonia < 1.5:** Alternância saudável de estresse.
* **Monotonia ≥ 2.0:** Alerta de treino monótono (alto risco de estagnação).

---

## 5. Prescrição Adaptativa e Comparativos

### 5.1. Comparação Transparente: Plano Original vs. Ajuste de Hoje
Para dar segurança ao atleta e clareza sobre as decisões do algoritmo, o sistema exibe o contraste entre o planejamento semanal e o ajuste diário:

```
Plano Original (Terça-feira): Rodagem Base Z2 (45 min)
↓
Ajuste de Hoje: Rodagem Regenerativa Z1/Z2 (25 min)
```

### 5.2. Orientação Prática do Treinador (Regra do Aquecimento)
Toda prescrição ajustada inclui a regra de segurança em campo:
> *"Se durante o aquecimento a FC subir acima do esperado ou a percepção de esforço ficar ≥5/10, substitua o treino por caminhada + mobilidade."*

---

## 6. Módulos Técnicos e Estrutura do Código

* `/src/coach/coachEngine.ts`: Motor puramente funcional em TypeScript. Não contém estados de React nem efeitos colaterais.
* `/src/components/CoachWorkspace.tsx`: Workspace principal integrando o Briefing do Atleta, Prescrição, Calibração de Dados do Garmin e Modal de Auditoria Fisiológica.
* `/src/components/TelemetryCharts.tsx`: Análise visual de telemetria baseada em dados reais de corrida.
* `/src/components/GpsMap.tsx`: Renderização do trajeto e métricas espaciais de rotas.
* `/src/i18n/LanguageContext.tsx`: Internacionalização dinâmica (PT, EN, ES, DE, FR, NL, IT).

---

## 7. Exportação e Compatibilidade Externa

* **Garmin Connect JSON Workouts:** Geração de treinos estruturados para download com metas de Frequência Cardíaca (fórmula de Karvonen) e ritmo (Pace).
* **Analisador de Arquivos FIT/GPX:** Processamento de telemetria pós-treino para recalculo real da carga acumulada.
