# MacroDrop

**Rota de entrega dinâmica com o algoritmo A\***: do entregador à cozinha, da cozinha ao cliente.

Projeto A3 de **Matemática Computacional Aplicada** (2026.2), UNP.

O MacroDrop simula uma entrega de marmitas fit. O cliente não espera em casa: ele recebe o pedido na saída da academia ou no campus, então o destino é dinâmico e a comida precisa chegar rápido e ainda quente. O programa calcula a **rota mais rápida** (e não a mais curta) usando o algoritmo **A\*** sobre um grafo que representa um bairro com cozinhas, academias e um campus.

O projeto tem duas versões que usam **exatamente a mesma lógica**:

| Versão | Arquivo principal | Como usar |
|---|---|---|
| Python (terminal) | `macrodrop_a_estrela.py` | Executar no terminal e digitar os locais e os empecilhos |
| App (React Native / Expo) | `App.js` | Interface com mapa animado e passo a passo do A\* |

---

## Sumário

- [O problema](#o-problema)
- [Como o grafo foi modelado](#como-o-grafo-foi-modelado)
- [O algoritmo A\*](#o-algoritmo-a)
- [Empecilhos nas ruas](#empecilhos-nas-ruas)
- [Resultados](#resultados)
- [Versão Python](#versão-python)
- [Versão app](#versão-app)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Equipe](#equipe)
- [Referências](#referências)

---

## O problema

A entrega tem **dois trechos**:

1. **Trecho 1 (retirada):** posição do entregador (GPS) até a cozinha.
2. **Trecho 2 (entrega):** cozinha até o ponto de entrega (academia ou campus).

O caminho mais curto nem sempre é o mais rápido: uma rua curta pode estar congestionada, em obra, alagada ou bloqueada, e custar mais tempo do que uma rua longa e livre. Por isso o critério do projeto é o **tempo de viagem em minutos**, não a distância.

## Como o grafo foi modelado

O mapa é um grafo não direcionado `G = (V, E, w)`:

- **16 vértices (V):** 3 cozinhas, 5 pontos de entrega (3 academias e 2 pontos do campus) e 8 pontos de passagem. Cada um tem coordenada GPS `(x, y)` em metros.
- **29 arestas (E):** ruas de mão dupla, cada uma com distância em metros e um fator de trânsito.
- **Pesos (w):** tempo de viagem em minutos.

| Tipo | Locais |
|---|---|
| Cozinhas | 1 Fit Prime · 2 Marmitaria Hipertrofia · 3 Zero Açúcar |
| Entrega | 4 Iron Gym · 5 Pulse · 6 Box CrossFit · 7 Campus Portaria · 8 Campus Biblioteca |
| Passagem | 9 Praça Central · 10 Terminal · 11 Shopping · 12 Parque · 13 Posto · 14 Residencial · 15 Mercado · 16 Base dos Entregadores |

A base de dados é **autoral**: locais, coordenadas e ruas foram definidos pelo grupo para representar um bairro com academias e um campus.

### Peso da aresta

```
w = d / (vmax × f)
```

- `d`: distância da rua, em metros
- `vmax`: 30 km/h = **500 m/min** (moto)
- `f`: fator de trânsito, de **1,0** (livre) a **0,4** (congestionada)

## O algoritmo A\*

O A\* é o Dijkstra com uma bússola. Ele escolhe o próximo nó pelo menor valor de:

```
f(n) = g(n) + h(n)
```

- `g(n)`: tempo real já gasto da origem até `n`, somando os pesos das ruas.
- `h(n)`: estimativa do tempo que falta até o destino.

### Heurística

```
h(n) = distância em linha reta (GPS) / 500
```

É o tempo de um entregador "voando" sem trânsito. Ela é **admissível** (nunca superestima o tempo real), porque nenhuma rua é mais curta que a linha reta entre seus pontos e nenhum trecho é mais rápido que 500 m/min. Por isso o A\* garante a rota ótima. O programa confere isso com um `assert` nas 29 ruas.

### Pseudocódigo

O pseudocódigo completo (dados, funções de custo, A\* e programa principal) está em [`Pseudocódigopython.md`](Pseudocódigopython.md).

## Empecilhos nas ruas

O usuário pode "estragar" uma rua para ver a rota mudar. Cada empecilho multiplica o fator de trânsito da rua:

| Empecilho | Efeito | Multiplicador (m) |
|---|---|---|
| `bloqueada` | rua sai do grafo | 0 |
| `alagada` | passagem muito lenta | 0,25 |
| `obra` | meia pista | 0,5 |
| `acidente` | trânsito parado em parte da via | 0,6 |

Com empecilho, o peso passa a ser `w = d / (500 × f × m)`.

**O A\* não precisa mudar.** Os empecilhos são aplicados ao montar o grafo: com `m = 0` a aresta não é criada. Como `m ≤ 1`, o tempo de uma rua só aumenta, então a heurística continua admissível e a rota continua ótima. Se o destino ficar isolado, o programa avisa que não existe caminho.

## Resultados

Exemplo: entregador na **Base (16)**, cozinha **Marmitaria (2)** e entrega na **Campus Biblioteca (8)**.

| Cenário | Trecho 1 (16 → 2) | Trecho 2 (2 → 8) | Total |
|---|---|---|---|
| Sem empecilhos | 16 → 12 → 4 → 2 · 3,52 min | 2 → 15 → 8 · 3,99 min | **7,51 min** |
| Com empecilhos | 16 → 1 → 9 → 2 · 4,00 min | 2 → 15 → 7 → 8 · 4,90 min | **8,91 min** |

Empecilhos do segundo cenário: rua 4–2 em **obra**, rua 15–8 **alagada** e rua 12–9 **bloqueada**. A rota desvia de todas.

Pontos de destaque:

- No trecho 1, a rota mais curta em metros (1.420 m, 4,52 min) perde para a rota escolhida pelo A\* (1.450 m, 3,52 min): são 30 m a mais e 1 minuto a menos, porque ela evita a rua 9–2, congestionada.
- O A\* expandiu **10 nós**, contra **21** do Dijkstra, chegando à mesma rota ótima.

## Versão Python

### Requisitos

- Python 3 (usa apenas a biblioteca padrão: `heapq` e `math`)

### Como executar

```bash
python macrodrop_a_estrela.py
```

O programa pede, nesta ordem:

1. O número da **posição atual do entregador**.
2. O número da **cozinha** (retirada).
3. O número do **ponto de entrega** (academia ou campus).
4. Os **empecilhos**, um por linha, no formato `LOCAL_A LOCAL_B TIPO`. Uma linha vazia encerra a entrada.

Exemplo de sessão:

```
Digite o número da POSIÇÃO ATUAL do entregador: 16
Digite o número da COZINHA (retirada): 2
Digite o número do PONTO DE ENTREGA (academia/campus): 8

Empecilho: 4 2 obra
Empecilho: 15 8 alagada
Empecilho: 12 9 bloqueada
Empecilho:
```

A saída mostra os locais de cada trecho, o tempo de cada um, o tempo total estimado e quantos nós o A\* expandiu. Rua inexistente ou tipo inválido é recusado na hora.

## Versão app

App mobile feito com **React Native** e **Expo**, que roda o mesmo algoritmo em JavaScript (a lógica fica no início do `App.js`, entre os marcadores `INICIO_LOGICA` e `FIM_LOGICA`) e mostra o resultado como um sistema de entrega real.

### Funcionalidades

- **Tela de início:** escolha do entregador, da cozinha e do destino por uma janelinha que sobe de baixo, e botão **Calcular estimativa de entrega** com o resultado dos dois trechos e o horário previsto de chegada.
- **Ruas com problema:** toque em uma rua para alternar entre livre, obra, alagada, acidente e bloqueada e ver a rota mudar. O app compara com o tempo sem empecilhos.
- **Mapa animado (SVG):** o entregador percorre a rota rua por rua (laranja indo à cozinha, azul levando ao cliente), com pausar, continuar e recomeçar.
- **Velocidade da animação:** ajustável dentro do app.
- **Análise do A\*:** anéis no mapa mostram quais pontos ficaram no caminho (verde) e quais foram só analisados (amarelo).
- **Passo a passo:** tela com cada expansão do A\* (nó, `g`, `h`, `f` e quantos esperam na fila).
- **Tabela de locais:** o que cada número significa no mapa.
- Botão voltar do Android volta ao início em vez de fechar o app.

### Tecnologias

- Expo (SDK 58), React 19 e React Native 0.88
- `react-native-svg` para desenhar o mapa
- `expo-splash-screen` e `expo-status-bar`
- EAS Build para gerar o APK

### Como executar em desenvolvimento

Requisitos: [Node.js](https://nodejs.org/) (versão LTS recente) e o app **Expo Go** no celular, ou um emulador.

```bash
npm install
npx expo start
```

Depois, escaneie o QR code com o Expo Go ou use `npm run android`, `npm run ios` ou `npm run web`.

### Como gerar o APK (Android)

O perfil `preview` do `eas.json` gera um APK de distribuição interna:

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

O identificador do pacote Android é `com.equipea3.macrodrop`.

## Estrutura do repositório

```
.
├── macrodrop_a_estrela.py    # versão Python (terminal)
├── Pseudocódigopython.md     # pseudocódigo usado na apresentação
├── App.js                    # versão app: lógica do A* + interface
├── index.js                  # ponto de entrada do Expo
├── app.json                  # configuração do app Expo
├── eas.json                  # perfis de build (development, preview, production)
├── package.json              # dependências e scripts
├── package-lock.json
└── assets/                   # ícones e splash screen do app
```

## Equipe

**Docentes**

- Profª Me. Edjane Azevêdo
- Prof. Dr. Ronyclei Raimundo da Silva

**Discentes**

- Keven Silva Teixeira
- Lucas Almeida Paiva Luna
- Marcus Vinicius Ramos Silveira
- João Gabriel Bessa de Sousa
- Humberto Dantas Bezerra Júnior
- Bruno Henrique Fernandes Brito
- Cesar Augusto Oliveira de Sousa

## Referências

- CORMEN, T. H. et al. *Algoritmos: teoria e prática*. 3. ed. Rio de Janeiro: Elsevier, 2012.
- DIJKSTRA, E. W. A note on two problems in connexion with graphs. *Numerische Mathematik*, v. 1, p. 269–271, 1959.
- HART, P. E.; NILSSON, N. J.; RAPHAEL, B. A formal basis for the heuristic determination of minimum cost paths. *IEEE Transactions on Systems Science and Cybernetics*, v. 4, n. 2, p. 100–107, 1968.
- RUSSELL, S.; NORVIG, P. *Inteligência artificial*. 3. ed. Rio de Janeiro: Elsevier, 2013.
- PYTHON SOFTWARE FOUNDATION. *heapq: heap queue algorithm*. Documentação do Python 3. Disponível em: <https://docs.python.org/3/library/heapq.html>.
