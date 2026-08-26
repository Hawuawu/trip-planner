import { Link, Stack } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import SearchIcon from '@mui/icons-material/Search';
import { buildGoogleMapsUrl, buildGoogleSearchUrl } from '../../utils/googleMapsLink';
import type { Location } from '../../types';

interface Props {
  location: Location | undefined;
  mapsFallbackQuery: string;
  name: string;
}

export function LocationLinks({ location, mapsFallbackQuery, name }: Props) {
  const showMapsLink = Boolean(location || mapsFallbackQuery);

  return (
    <Stack direction="row" spacing={2}>
      {showMapsLink && (
        <Link
          href={buildGoogleMapsUrl(location, mapsFallbackQuery)}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <MapIcon fontSize="small" /> Google Maps
        </Link>
      )}
      {name.trim() && (
        <Link
          href={buildGoogleSearchUrl(name.trim())}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <SearchIcon fontSize="small" /> Google Search
        </Link>
      )}
    </Stack>
  );
}
