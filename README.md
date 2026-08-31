# Finora

App web de controle financeiro pessoal, inspirado na planilha de mesmo nome. Feito com React + Vite + TypeScript + Tailwind + Recharts, com dados salvos no navegador (LocalStorage) e pronto para deploy no Cloudflare Pages.

## Estrutura (espelhando a planilha)

| Aba da planilha              | No app                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| Dashboard                    | Aba **Dashboard**: indicadores, gráficos e tabela           |
| Planilha Financeira - Orange | Aba **Lançamentos**: cadastro de despesas                   |
| Calc_Data                    | `src/lib/calc.ts`: consolidações (por mês, categoria, etc.) |
| Banco de dados               | Aba **Configurações**: categorias, cores e classificações   |

## Funcionalidades

- **Indicadores**: Total de Gastos, Total Pago, Total Pendente
- **Gráficos**: Gastos por Categoria (pizza) e Comparação de Meses (barras)
- **Lançamentos**: descrição, categoria, data, valor, parcelado e pago
- **Configurações**: categorias com cor e classificação (Essencial, Fixo, Variável, Supérfluo)
- Dados persistidos no LocalStorage

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (geralmente http://localhost:5173).

## Build de produção

```bash
npm run build
npm run preview
```

## Deploy no Cloudflare Pages

1. Faça push do projeto para o GitHub (`JoaoSantosCodes/Finora`).
2. No painel do Cloudflare, crie um projeto em **Workers & Pages > Pages > Connect to Git**.
3. Configure o build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Salve e faça o deploy.

O arquivo `public/_redirects` já garante o roteamento SPA.

## Próximos passos possíveis

- Backend com Cloudflare D1 (SQLite) para sincronizar entre dispositivos
- Importação dos dados diretamente do Google Sheets
- Filtros por período e por categoria no Dashboard
