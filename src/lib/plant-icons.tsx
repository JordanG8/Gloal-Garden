import { createElement } from "react";
import {
  Apple,
  Camera,
  Carrot,
  Droplets,
  Eye,
  Flower2,
  Hand,
  Handshake,
  Home,
  Leaf,
  RefreshCw,
  ShoppingBasket,
  Siren,
  Sprout,
  Sun,
  TreeDeciduous,
  TreePine,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * The app's single source of pictograms — everything renders lucide icons,
 * never emoji. Species map to their category icon; trust levels and badges
 * map by id. Exposed as wrapper components (via createElement) so callers
 * never assign component variables during render.
 */

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  vegetable: Carrot,
  fruit: Apple,
  herb: Leaf,
  tree: TreePine,
};

export function CategoryIcon({ category, ...props }: { category: string } & LucideProps) {
  return createElement(CATEGORY_ICONS[category] ?? Sprout, props);
}

/** Keyed by TrustLevel.level. */
const TRUST_LEVEL_ICONS: Record<number, LucideIcon> = {
  0: Sprout,
  1: Leaf,
  2: Flower2,
  3: Sun,
  4: TreeDeciduous,
};

export function TrustLevelIcon({ level, ...props }: { level: number } & LucideProps) {
  return createElement(TRUST_LEVEL_ICONS[level] ?? Sprout, props);
}

/** Keyed by BadgeDef.id. */
const BADGE_ICONS: Record<string, LucideIcon> = {
  first_sprout: Sprout,
  green_thumb: Hand,
  first_harvest: Apple,
  provider: ShoppingBasket,
  rainmaker: Droplets,
  lifesaver: Siren,
  good_neighbor: Handshake,
  foster_gardener: Home,
  watchful_eye: Eye,
  documentarian: Camera,
  full_circle: RefreshCw,
  garden_elder: TreeDeciduous,
};

export function BadgeIcon({ badgeId, ...props }: { badgeId: string } & LucideProps) {
  return createElement(BADGE_ICONS[badgeId] ?? Sprout, props);
}
