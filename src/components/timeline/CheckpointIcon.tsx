import FlightIcon from '@mui/icons-material/Flight';
import TrainIcon from '@mui/icons-material/Train';
import SubwayIcon from '@mui/icons-material/Subway';
import HotelIcon from '@mui/icons-material/Hotel';
import PlaceIcon from '@mui/icons-material/Place';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { SvgIconProps } from '@mui/material';
import type { CheckpointType } from '../../types';

interface Props extends SvgIconProps {
  type: CheckpointType;
}

export function CheckpointIcon({ type, ...props }: Props) {
  switch (type) {
    case 'flight': return <FlightIcon {...props} />;
    case 'train':  return <TrainIcon {...props} />;
    case 'metro':  return <SubwayIcon {...props} />;
    case 'hotel':  return <HotelIcon {...props} />;
    case 'poi':    return <PlaceIcon {...props} />;
    default:       return <RadioButtonUncheckedIcon {...props} />;
  }
}
