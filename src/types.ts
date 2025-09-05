interface CatItem {
  id: string;
  src: string;
}

type SwipeDirection = 'left' | 'right';

interface AppState {
  items: CatItem[];
  index: number;
  liked: CatItem[];
  disliked: CatItem[];
  isLoading: boolean;
  error: string | null;
}
