import {
  formatBRL,
  type MenuProduct,
  type OptionGroup,
  type ProductOption,
} from "./models";

export type { OptionGroup, ProductOption };
export type Product = MenuProduct;

export const categories = [
  { id: "todos", label: "Todos" },
  { id: "destaques", label: "Destaques" },
  { id: "cafes", label: "Cafés" },
  { id: "sobremesas", label: "Sobremesas" },
  { id: "almoco", label: "Almoço" },
  { id: "saladas", label: "Saladas" },
  { id: "bebidas", label: "Bebidas" },
];

export const defaultProducts: Product[] = [
  {
    id: "combo-cafe",
    categoryId: "cat-coffe-love-cafes",
    category: "cafes",
    name: "Combo Café da Manhã",
    description: "Cappuccino cremoso, pão de queijo e fatia de bolo artesanal.",
    price: 24.9,
    image: "/images/cafe.png",
    featured: true,
    available: true,
    badge: "Mais pedido",
    optionGroups: [
      {
        name: "Bebida",
        required: true,
        max: 1,
        options: [
          { name: "Cappuccino", price: 0 },
          { name: "Café com leite", price: 0 },
          { name: "Chocolate quente", price: 2 },
        ],
      },
    ],
  },
  {
    id: "cappuccino",
    categoryId: "cat-coffe-love-cafes",
    category: "cafes",
    name: "Cappuccino Cremoso",
    description: "Café espresso, leite vaporizado e uma finalização delicada de canela.",
    price: 9.9,
    image: "/images/cafe.png",
    featured: true,
    available: true,
    optionGroups: [
      {
        name: "Tamanho",
        required: true,
        max: 1,
        options: [
          { name: "Pequeno", price: 0 },
          { name: "Médio", price: 3 },
          { name: "Grande", price: 5 },
        ],
      },
      {
        name: "Adicionais",
        max: 2,
        options: [
          { name: "Chantilly", price: 2 },
          { name: "Dose extra de espresso", price: 3 },
          { name: "Leite sem lactose", price: 2 },
        ],
      },
    ],
  },
  {
    id: "cafe-gelado",
    categoryId: "cat-coffe-love-cafes",
    category: "cafes",
    name: "Café Gelado",
    description: "Espresso duplo, leite e gelo, levemente adoçado.",
    price: 14.9,
    image: "/images/cafe.png",
    available: true,
  },
  {
    id: "cheesecake",
    categoryId: "cat-coffe-love-sobremesas",
    category: "sobremesas",
    name: "Cheesecake Artesanal",
    description: "Fatia cremosa com cobertura escolhida por você.",
    price: 16.9,
    image: "/images/sobremesas.png",
    featured: true,
    available: true,
    badge: "Favorito",
    optionGroups: [
      {
        name: "Cobertura",
        required: true,
        max: 1,
        options: [
          { name: "Goiabada", price: 0 },
          { name: "Frutas vermelhas", price: 2 },
          { name: "Caramelo", price: 1.5 },
        ],
      },
    ],
  },
  {
    id: "brownie",
    categoryId: "cat-coffe-love-sobremesas",
    category: "sobremesas",
    name: "Brownie com Sorvete",
    description: "Brownie aquecido, sorvete de baunilha e calda de chocolate.",
    price: 18.9,
    image: "/images/sobremesas.png",
    featured: true,
    available: true,
  },
  {
    id: "bolo-chocolate",
    categoryId: "cat-coffe-love-sobremesas",
    category: "sobremesas",
    name: "Bolo de Chocolate",
    description: "Fatia generosa com recheio cremoso e cacau.",
    price: 14.9,
    image: "/images/sobremesas.png",
    available: true,
  },
  {
    id: "prato-frango",
    categoryId: "cat-coffe-love-almoco",
    category: "almoco",
    name: "Executivo de Frango",
    description: "Frango grelhado, arroz, feijão, salada e uma guarnição.",
    price: 24.9,
    image: "/images/almoco.png",
    featured: true,
    available: true,
    badge: "Almoço",
    optionGroups: [
      {
        name: "Guarnição",
        required: true,
        max: 1,
        options: [
          { name: "Batata frita", price: 0 },
          { name: "Purê de batata", price: 0 },
          { name: "Legumes", price: 0 },
        ],
      },
    ],
  },
  {
    id: "massa",
    categoryId: "cat-coffe-love-almoco",
    category: "almoco",
    name: "Massa ao Molho Especial",
    description: "Massa preparada com molho artesanal e queijo ralado.",
    price: 23.9,
    image: "/images/almoco.png",
    available: true,
  },
  {
    id: "salada-coffe",
    categoryId: "cat-coffe-love-saladas",
    category: "saladas",
    name: "Salada Coffe Love",
    description: "Folhas, tomate, cenoura, proteína e molho especial.",
    price: 19.9,
    image: "/images/almoco.png",
    available: true,
    optionGroups: [
      {
        name: "Proteína",
        required: true,
        max: 1,
        options: [
          { name: "Frango grelhado", price: 0 },
          { name: "Atum", price: 2 },
          { name: "Sem proteína", price: 0 },
        ],
      },
    ],
  },
  {
    id: "suco-natural",
    categoryId: "cat-coffe-love-bebidas",
    category: "bebidas",
    name: "Suco Natural",
    description: "Preparado na hora com fruta selecionada.",
    price: 9.9,
    image: "/images/almoco.png",
    available: true,
    optionGroups: [
      {
        name: "Sabor",
        required: true,
        max: 1,
        options: [
          { name: "Laranja", price: 0 },
          { name: "Acerola", price: 0 },
          { name: "Maracujá", price: 0 },
        ],
      },
    ],
  },
  {
    id: "refrigerante",
    categoryId: "cat-coffe-love-bebidas",
    category: "bebidas",
    name: "Refrigerante Lata",
    description: "Lata individual bem gelada.",
    price: 6,
    image: "/images/cafe.png",
    available: true,
    optionGroups: [
      {
        name: "Sabor",
        required: true,
        max: 1,
        options: [
          { name: "Cola", price: 0 },
          { name: "Guaraná", price: 0 },
          { name: "Laranja", price: 0 },
        ],
      },
    ],
  },
  {
    id: "agua",
    categoryId: "cat-coffe-love-bebidas",
    category: "bebidas",
    name: "Água Mineral",
    description: "Garrafa individual, com ou sem gás.",
    price: 3.5,
    image: "/images/cafe.png",
    available: true,
  },
];

export { formatBRL };

export const PRODUCTS_KEY = "caruarufood-demo-products-v1";
export const CART_KEY = "caruarufood-demo-cart-v1";
