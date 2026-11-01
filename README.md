# 🍲 Sabor Mineiro ACK - Caldos no Capricho em Nantucket

Cardápio digital moderno e responsivo com integração direta para pedidos via WhatsApp, desenvolvido para entregas em toda a ilha de Nantucket Island, MA.

---

## 📁 Estrutura de Pastas e Arquivos

O projeto foi organizado de forma modular, limpa e padronizada:

```
sabor-mineiro-ack/
├── assets/
│   ├── favicon.svg          # Ícone SVG de tigela de caldo fumegante
│   └── images/              # Diretório para fotos locais e banners
├── css/
│   └── style.css            # Estilos personalizados (glassmorphism, animações, badges, toasts)
├── js/
│   ├── cart.js              # Lógica do carrinho, cálculos, toasts e montagem do link WhatsApp
│   ├── snow.js              # Animação suave e otimizada de neve caindo (Canvas)
│   └── main.js              # Inicialização de observers, animações de scroll e comportamento do header
├── index.html               # Página principal estruturada com Tailwind CSS e semântica moderna
├── server.js                # Servidor HTTP local zero-dependências (nativo do Node.js)
├── package.json             # Scripts de inicialização e metadados do projeto
└── README.md                # Documentação e instruções de uso
```

---

## 🚀 Como Executar o Projeto

Você tem várias maneiras fáceis de rodar o projeto:

### Opção 1: Via npm (Recomendado)
No terminal, dentro da pasta do projeto:
```bash
npm start
```
ou:
```bash
npm run dev
```

### Opção 2: Direto com Node.js (Zero dependências)
```bash
node server.js
```
Acesse no seu navegador: **[http://localhost:3000](http://localhost:3000)**

### Opção 3: Abrir diretamente no Navegador
Você também pode simplesmente abrir o arquivo `index.html` no Google Chrome ou qualquer outro navegador moderno clicando duas vezes nele.

---

## ⚙️ Configurações Rápidas

Todas as configurações principais estão centralizadas no arquivo [`js/cart.js`](js/cart.js):

- **Número do WhatsApp:**
  Altere a constante `WHATSAPP_NUMBER`:
  ```javascript
  const WHATSAPP_NUMBER = "17729403676";
  ```

- **Preço por Caldo:**
  Altere a constante `PRICE_PER_UNIT`:
  ```javascript
  const PRICE_PER_UNIT = 20; // Valor em USD
  ```

- **Nomes dos Itens:**
  No objeto `ITEM_NAMES`:
  ```javascript
  const ITEM_NAMES = {
      frango: 'Caldo de Frango com Milho',
      mandioca: 'Caldo de Mandioca Especial'
  };
  ```

---

## ✨ Recursos Implementados

- 📱 **Totalmente Otimizado para Mobile**: Layout responsivo, toques confortáveis (44px+), tipografia ajustada.
- 💬 **Pedido via WhatsApp em 1 Clique**: Gera mensagem automática estruturada com os itens, total, nome e endereço em Nantucket.
- ❄️ **Efeito Neve Inteligente**: Animação em canvas que pausa automaticamente ao mudar de aba para economizar bateria e reduz partículas no celular.
- 🔔 **Toasts e Feedback Visual**: Confirmações elegantes sem alertas intrusivos ao adicionar produtos.
- 🛡️ **Segurança e Estabilidade**: Prevenção de toques duplicados e verificação de campos.
