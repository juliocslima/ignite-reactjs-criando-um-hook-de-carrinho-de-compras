import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { STORAGE_KEY } from '../constants';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem(`${STORAGE_KEY}:cart`);

    if (storagedCart) {
      
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const addProduct = async (productId: number) => {
    try {
      // Verificar se existe produto no estoque
      const { data: stock } = await api.get<Stock>(`/stock/${productId}`);

      // Criar carrinho para atualização
      const updatedCart = [...cart];

      // verificar se já existe produto no carrinho do usuário
      const existingProduct = cart.find(product => product.id === productId);
      const currentAmount = existingProduct ? existingProduct.amount : 0;
      const amount = currentAmount + 1;

      if(amount > stock.amount) {
        throw new Error('Quantidade solicitada fora de estoque');
      }

      // se não existir o produto no carrinho do usuário
      // buscar dados do produto na api para inclusão
      if(!existingProduct) {
        const { data } = await api.get<Omit<Product, 'amount'>>(`/products/${productId}`);

        const newProduct = {
          ...data,
          amount: 1
        }
        
        updatedCart.push(newProduct);
        
      } else {
        // se já existir produto no carrinho, acrescenta uma unidade
        existingProduct.amount = amount;
      }

      setCart(updatedCart);

      // Atualizar carrinho no localstorage
      localStorage.setItem(`${STORAGE_KEY}:cart`, JSON.stringify(updatedCart));

    } catch(err: any) {
      /***
      Captura qualquer erro que houver na inclusão do produto
      no carrinho e mostra para o usuário em um Toast
      ***/
      toast.error(
        err.message === 'Quantidade solicitada fora de estoque'
        ? err.message
        : 'Erro na adição do produto'
      );
    }
  };

  const removeProduct = (productId: number) => {
    try {

      // Verificar se produto existe no carrinho
      const existingProduct = cart.find(product => product.id === productId);


      if(!existingProduct) {
        // Caso não exista gerar erro
        throw new Error('Erro na remoção do produto');
      } else {
        // Se existir, filtrar no carrinho todos os produtos
        // diferente do produto selecionado e gerar um novo
        // carrinho, salvando no localStorage
        const updatedCart = cart.filter(product => product.id !== productId)

        localStorage.setItem(`${STORAGE_KEY}:cart`, JSON.stringify(updatedCart));

        setCart(updatedCart);
      }
    } catch(err: any) {
      /***
      Captura qualquer erro que houver na exclusão do produto
      no carrinho e mostra para o usuário em um Toast
      ***/
      toast.error(
        err.message === 'Erro na remoção do produto'
        ? err.message
        : 'Unknow error on delete product in cart'
      );
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount < 1) {
        throw new Error('Erro na alteração de quantidade do produto')
      }

      // verificar se já existe produto no carrinho do usuário
      let existingProduct = cart.find(product => product.id === productId);

      if(!existingProduct) {
        throw new Error('Erro na alteração de quantidade do produto')
      }

      const { data: productStock } = await api.get<Stock>(`/stock/${productId}`)

      if (amount > productStock.amount) {
        throw new Error('Quantidade solicitada fora de estoque');
      }

      const newCart = cart.map(product => product.id !== productId ? product : {
        ...product,
        amount,
      })

      localStorage.setItem(`${STORAGE_KEY}:cart`, JSON.stringify(newCart))

      setCart(newCart)
    } catch(err: any) {
      /***
      Captura qualquer erro que houver na atualização do produto
      no carrinho e mostra para o usuário em um Toast
      ***/
      toast.error(
        err.message === 'Erro na alteração de quantidade do produto' 
        || 'Quantidade solicitada fora de estoque'
        ? err.message
        : 'Unknow error on delete product in cart'
      );
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
