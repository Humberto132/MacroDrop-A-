import heapq
import math

# =========================================================
# MACRODROP - ROTA DE ENTREGA DINÂMICA COM A*
# =========================================================
# O entregador sai da sua posição atual (GPS), retira a
# refeição na cozinha e entrega no ponto dinâmico do cliente
# (saída da academia ou campus universitário).
#
# A* escolhe o próximo nó por:  f(n) = g(n) + h(n)
#   g(n) = tempo real já gasto até n (minutos)
#   h(n) = estimativa do tempo de n até o destino (minutos)

# Velocidade máxima do entregador (moto): 30 km/h = 500 m/min
VELOCIDADE_MAX = 500


# =========================================================
# EMPECILHOS NAS RUAS
# =========================================================
# Cada empecilho multiplica o fator de trânsito da rua.
# Fator 0 = rua bloqueada: ela sai do grafo.
# Como todo fator é <= 1, o tempo da rua só aumenta, então
# a heurística continua admissível.

EMPECILHOS = {
    "bloqueada": 0.0,   # interditada, não dá para passar
    "alagada": 0.25,    # passagem muito lenta
    "obra": 0.5,        # meia pista
    "acidente": 0.6,    # trânsito parado em parte da via
}


# =========================================================
# CUSTO DA ARESTA (g)
# =========================================================
# tempo = distancia / (velocidade maxima * fator de transito)
# transito: 1.0 = rua livre, 0.4 = rua congestionada

def calcular_custo(distancia, transito):
    return distancia / (VELOCIDADE_MAX * transito)


# =========================================================
# FUNÇÃO DA HEURÍSTICA (h)
# =========================================================
# Tempo em linha reta (coordenadas GPS) na velocidade máxima.
# Nunca superestima o tempo real, então o A* garante a rota ótima.

def heuristica(no, destino):
    x1, y1 = coordenadas[no]
    x2, y2 = coordenadas[destino]
    return math.hypot(x2 - x1, y2 - y1) / VELOCIDADE_MAX


# =========================================================
# ALGORITMO A*
# =========================================================

def a_estrela(grafo, origem, destino):

    # (f, g, nó, caminho)
    fila = [(heuristica(origem, destino), 0, origem, [])]
    visitados = set()

    while fila:

        _, custo_atual, no_atual, caminho = heapq.heappop(fila)

        if no_atual in visitados:
            continue

        visitados.add(no_atual)

        caminho = caminho + [no_atual]

        # Se chegou ao destino
        if no_atual == destino:
            return custo_atual, caminho, len(visitados)

        # Percorre vizinhos
        for vizinho, distancia, transito in grafo[no_atual]:

            if vizinho not in visitados:

                novo_custo = custo_atual + calcular_custo(distancia, transito)

                heapq.heappush(
                    fila,
                    (
                        novo_custo + heuristica(vizinho, destino),
                        novo_custo,
                        vizinho,
                        caminho
                    )
                )

    return float("inf"), [], len(visitados)


# =========================================================
# NOMES DOS LOCAIS
# =========================================================

locais = {

    1: "Cozinha Fit Prime",
    2: "Marmitaria Hipertrofia",
    3: "Cozinha Zero Açúcar",
    4: "Academia Iron Gym",
    5: "Academia Pulse",
    6: "Box CrossFit",
    7: "Campus - Portaria",
    8: "Campus - Biblioteca",
    9: "Praça Central",
    10: "Terminal de Ônibus",
    11: "Shopping",
    12: "Parque",
    13: "Posto de Gasolina",
    14: "Residencial",
    15: "Mercado",
    16: "Base dos Entregadores"
}


# =========================================================
# COORDENADAS GPS DOS LOCAIS (x, y) EM METROS
# =========================================================

coordenadas = {

    1: (0, 0),
    2: (800, 600),
    3: (1500, -200),
    4: (400, 900),
    5: (1200, 300),
    6: (2000, 800),
    7: (1000, 1500),
    8: (1400, 1800),
    9: (600, 200),
    10: (300, -400),
    11: (1700, 400),
    12: (200, 500),
    13: (1000, -300),
    14: (2200, 0),
    15: (1300, 1000),
    16: (-200, 300)
}


# =========================================================
# RUAS (MÃO DUPLA)
# FORMATO:
# (local A, local B, distancia em metros, transito)
# =========================================================

ruas = [

    (1, 9, 650, 0.9),
    (1, 10, 520, 1.0),
    (1, 12, 560, 0.8),
    (1, 16, 380, 1.0),
    (16, 12, 460, 0.9),
    (12, 4, 470, 0.7),
    (12, 9, 510, 0.6),
    (9, 2, 450, 0.5),
    (9, 5, 620, 0.4),
    (9, 13, 660, 0.9),
    (10, 13, 720, 1.0),
    (13, 3, 530, 0.9),
    (13, 5, 650, 0.8),
    (3, 14, 750, 1.0),
    (3, 11, 640, 0.6),
    (5, 11, 520, 0.5),
    (5, 2, 510, 0.7),
    (5, 15, 720, 0.8),
    (2, 4, 520, 0.9),
    (2, 15, 650, 0.6),
    (4, 7, 870, 0.8),
    (15, 7, 600, 0.7),
    (7, 8, 510, 1.0),
    (15, 6, 740, 0.9),
    (15, 8, 820, 0.9),
    (11, 6, 520, 0.8),
    (11, 14, 660, 1.0),
    (6, 14, 840, 1.0),
    (6, 8, 1200, 0.9)
]


# =========================================================
# MONTAR GRAFO
# nó: [(vizinho, distancia, transito)]
# empecilhos: {frozenset({A, B}): tipo}
# =========================================================

def montar_grafo(empecilhos):

    grafo = {no: [] for no in locais}

    for a, b, distancia, transito in ruas:

        # Garante que a heurística nunca superestima:
        # nenhuma rua pode ser mais curta que a linha reta
        assert distancia >= heuristica(a, b) * VELOCIDADE_MAX, (a, b)

        tipo = empecilhos.get(frozenset((a, b)))

        if tipo is not None:
            transito = transito * EMPECILHOS[tipo]

        # Rua bloqueada não entra no grafo
        if transito == 0:
            continue

        grafo[a].append((b, distancia, transito))
        grafo[b].append((a, distancia, transito))

    return grafo


# =========================================================
# MOSTRAR LOCAIS
# =========================================================

print("\n========== LOCAIS DISPONÍVEIS ==========\n")

for numero, nome in locais.items():
    print(numero, "-", nome)


# =========================================================
# ENTRADA DO USUÁRIO
# =========================================================

entregador = int(input("\nDigite o número da POSIÇÃO ATUAL do entregador: "))
cozinha = int(input("Digite o número da COZINHA (retirada): "))
entrega = int(input("Digite o número do PONTO DE ENTREGA (academia/campus): "))

for numero in (entregador, cozinha, entrega):
    if numero not in locais:
        raise SystemExit(f"Local inválido: {numero}")


# =========================================================
# ENTRADA DOS EMPECILHOS
# Formato: local A, local B e tipo. Ex.: 4 2 obra
# Linha vazia encerra.
# =========================================================

ruas_existentes = {frozenset((a, b)) for a, b, _, _ in ruas}
empecilhos = {}

print("\n========== EMPECILHOS ==========")
print("Tipos:", ", ".join(EMPECILHOS))
print("Digite: LOCAL_A LOCAL_B TIPO (ex.: 4 2 obra). Enter vazio para terminar.")

while True:

    linha = input("Empecilho: ").split()

    if not linha:
        break

    if len(linha) != 3 or not linha[0].isdigit() or not linha[1].isdigit():
        print("  Formato inválido. Use: LOCAL_A LOCAL_B TIPO")
        continue

    a, b, tipo = int(linha[0]), int(linha[1]), linha[2].lower()

    if frozenset((a, b)) not in ruas_existentes:
        print(f"  Não existe rua entre {a} e {b}.")
        continue

    if tipo not in EMPECILHOS:
        print("  Tipo inválido. Use:", ", ".join(EMPECILHOS))
        continue

    empecilhos[frozenset((a, b))] = tipo
    print(f"  Rua {locais[a]} <-> {locais[b]}: {tipo}")

grafo = montar_grafo(empecilhos)


# =========================================================
# EXECUTAR A*
# Trecho 1: entregador -> cozinha
# Trecho 2: cozinha -> ponto de entrega
# =========================================================

tempo1, caminho1, expandidos1 = a_estrela(grafo, entregador, cozinha)
tempo2, caminho2, expandidos2 = a_estrela(grafo, cozinha, entrega)


# =========================================================
# RESULTADO
# =========================================================

print("\n========== RESULTADO ==========\n")

if empecilhos:
    print("Empecilhos considerados:")
    for rua, tipo in empecilhos.items():
        a, b = sorted(rua)
        print(f"  {locais[a]} <-> {locais[b]}: {tipo}")
    print()

if caminho1 and caminho2:

    print("Trecho 1 - Retirada na cozinha:\n")

    for no in caminho1:
        print(locais[no])

    print("\nTempo:", round(tempo1, 2), "min")

    print("\nTrecho 2 - Entrega ao cliente:\n")

    for no in caminho2:
        print(locais[no])

    print("\nTempo:", round(tempo2, 2), "min")

    print("\nTempo total estimado:", round(tempo1 + tempo2, 2), "min")
    print(
        "Nós expandidos pelo A*:",
        expandidos1 + expandidos2,
        "de",
        2 * len(locais),
        "possíveis"
    )

else:
    print("Não existe caminho: os empecilhos isolaram a origem ou o destino.")
