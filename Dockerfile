FROM node:20-slim

# Instalar Python 3 y herramientas de compilacion
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Instalar dependencias de Python
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt || pip3 install --no-cache-dir -r requirements.txt

# Copiar el codigo del proyecto
COPY . .

# Puerto configurado por Render o por defecto 3050
ENV PORT=3050
ENV HOST=0.0.0.0
EXPOSE 3050

# Iniciar servidor
CMD ["node", "src/index.js"]

