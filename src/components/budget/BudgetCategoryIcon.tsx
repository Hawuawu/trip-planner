import FlightIcon from '@mui/icons-material/Flight';
import HotelIcon from '@mui/icons-material/Hotel';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { SvgIconProps } from '@mui/material';
import type { BudgetCategory } from '../../types';

interface Props extends SvgIconProps {
  category: BudgetCategory;
}

export function BudgetCategoryIcon({ category, ...props }: Props) {
  switch (category) {
    case 'travel':
      return <FlightIcon {...props} />;
    case 'hotel':
      return <HotelIcon {...props} />;
    case 'meals':
      return <RestaurantIcon {...props} />;
    case 'merchandise':
      return <ShoppingBagIcon {...props} />;
    default:
      return <RadioButtonUncheckedIcon {...props} />;
  }
}
