import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FirebaseClientTripRepository } from '../repository/FirebaseClientTripRepository.js';

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

const checkpointTypeSchema = z.enum(['flight', 'train', 'metro', 'hotel', 'poi', 'other']);

const checkpointInputSchema = z.object({
  type: checkpointTypeSchema,
  name: z.string(),
  startTime: z.string().describe('ISO 8601 timestamp'),
  endTime: z.string().describe('ISO 8601 timestamp').optional(),
  location: locationSchema.optional(),
  notes: z.string().optional(),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'Free-form labels for filtering in the app. Call list_tags first and reuse an existing ' +
        'tag where one fits — do not invent a near-duplicate (e.g. "Food" or "dining") of a tag ' +
        'that already exists.'
    ),
  linkedBookingId: z.string().optional(),
});

const alternativeInputSchema = z.object({
  type: checkpointTypeSchema,
  name: z.string(),
  location: locationSchema.optional(),
  notes: z.string().optional(),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'Free-form labels for filtering in the app. Call list_tags first and reuse an existing ' +
        'tag where one fits — do not invent a near-duplicate (e.g. "Food" or "dining") of a tag ' +
        'that already exists.'
    ),
});

const bookingInputSchema = z.object({
  provider: z.string(),
  confirmationNumber: z.string(),
  notes: z.string().optional(),
});

const routeInputSchema = z.object({
  name: z.string(),
  days: z.array(z.string()).describe('YYYY-MM-DD date keys this route covers'),
  checkpointIds: z.array(z.string()),
});

const wikiSectionInputSchema = z.object({
  title: z.string(),
  content: z
    .string()
    .describe(
      'Markdown. Link to a checkpoint/alternative/route from within the text using an ' +
        'internal link of the form [label](trip://checkpoint/<id>), ' +
        '[label](trip://alternative/<id>), or [label](trip://route/<id>).'
    ),
  order: z.number().describe("Sort position among the trip's wiki sections, ascending."),
});

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// Every tool here is add/update/read only — no delete_* tool exists in this
// server by design (see the trip-planner #22 refresh: "delete should not be
// possible yet through MCP"). Membership management (invite/remove/leave)
// and an activity-log reader are deliberately out of scope for this pass too.
export function registerTools(server: McpServer, repo: FirebaseClientTripRepository): void {
  server.tool('list_trips', 'List every trip the signed-in user is a member of.', {}, async () =>
    json(await repo.listTrips())
  );

  server.tool('get_trip', 'Get a single trip by id.', { tripId: z.string() }, async ({ tripId }) =>
    json(await repo.getTrip(tripId))
  );

  server.tool(
    'create_trip',
    'Create a new trip. The signed-in user becomes its owner and sole member.',
    { name: z.string(), dateRange: z.object({ start: z.string(), end: z.string() }) },
    async ({ name, dateRange }) => json(await repo.createTrip(name, dateRange))
  );

  server.tool(
    'update_trip',
    'Rename a trip or change its date range. Owner-only, enforced by Firestore rules.',
    {
      tripId: z.string(),
      changes: z.object({
        name: z.string().optional(),
        dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
      }),
    },
    async ({ tripId, changes }) => {
      await repo.updateTrip(tripId, changes);
      return json({ ok: true });
    }
  );

  server.tool(
    'list_tags',
    "List every distinct tag currently used across a trip's checkpoints and alternatives, " +
      'sorted alphabetically. Call this before setting tags on a checkpoint or alternative — ' +
      'prefer reusing an existing tag from this list over inventing a new one, so the tag ' +
      'vocabulary stays consistent for filtering in the app.',
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listTags(tripId))
  );

  server.tool(
    'list_checkpoints',
    "List a trip's timeline checkpoints, sorted by start time.",
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listCheckpoints(tripId))
  );

  server.tool(
    'get_checkpoint',
    'Get a single checkpoint by id.',
    { tripId: z.string(), checkpointId: z.string() },
    async ({ tripId, checkpointId }) => json(await repo.getCheckpoint(tripId, checkpointId))
  );

  server.tool(
    'add_checkpoint',
    "Add one checkpoint to a trip's timeline.",
    { tripId: z.string(), checkpoint: checkpointInputSchema },
    async ({ tripId, checkpoint }) => json(await repo.addCheckpoint(tripId, checkpoint))
  );

  server.tool(
    'add_checkpoints',
    "Add several checkpoints to a trip's timeline in one call — e.g. importing a drafted itinerary.",
    { tripId: z.string(), checkpoints: z.array(checkpointInputSchema) },
    async ({ tripId, checkpoints }) => json(await repo.addCheckpoints(tripId, checkpoints))
  );

  server.tool(
    'update_checkpoint',
    'Edit fields on an existing checkpoint.',
    {
      tripId: z.string(),
      checkpointId: z.string(),
      changes: checkpointInputSchema.partial(),
    },
    async ({ tripId, checkpointId, changes }) => {
      await repo.updateCheckpoint(tripId, checkpointId, changes);
      return json({ ok: true });
    }
  );

  server.tool(
    'list_alternatives',
    "List a trip's alternatives shelf — points of interest not yet committed to the timeline.",
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listAlternatives(tripId))
  );

  server.tool(
    'add_alternative',
    "Add one point of interest to a trip's alternatives shelf.",
    { tripId: z.string(), alternative: alternativeInputSchema },
    async ({ tripId, alternative }) => json(await repo.addAlternative(tripId, alternative))
  );

  server.tool(
    'add_alternatives',
    "Add several points of interest to a trip's alternatives shelf in one call.",
    { tripId: z.string(), alternatives: z.array(alternativeInputSchema) },
    async ({ tripId, alternatives }) => json(await repo.addAlternatives(tripId, alternatives))
  );

  server.tool(
    'update_alternative',
    'Edit fields on an existing alternative.',
    { tripId: z.string(), alternativeId: z.string(), changes: alternativeInputSchema.partial() },
    async ({ tripId, alternativeId, changes }) => {
      await repo.updateAlternative(tripId, alternativeId, changes);
      return json({ ok: true });
    }
  );

  server.tool(
    'promote_alternative',
    'Promote an alternative onto the timeline as a checkpoint at the given start time. The ' +
      'alternative is removed from the shelf as part of this (same as the web app) — the ' +
      "server's general no-delete-tools scope doesn't apply to this atomic promotion step.",
    {
      tripId: z.string(),
      alternativeId: z.string(),
      startTime: z.string().describe('ISO 8601 timestamp'),
    },
    async ({ tripId, alternativeId, startTime }) => {
      await repo.promoteAlternative(tripId, alternativeId, startTime);
      return json({ ok: true });
    }
  );

  server.tool(
    'list_bookings',
    "List a trip's bookings.",
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listBookings(tripId))
  );

  server.tool(
    'add_booking',
    'Add a booking (confirmation details) to a trip.',
    { tripId: z.string(), booking: bookingInputSchema },
    async ({ tripId, booking }) => json(await repo.addBooking(tripId, booking))
  );

  server.tool(
    'update_booking',
    'Edit fields on an existing booking.',
    { tripId: z.string(), bookingId: z.string(), changes: bookingInputSchema.partial() },
    async ({ tripId, bookingId, changes }) => {
      await repo.updateBooking(tripId, bookingId, changes);
      return json({ ok: true });
    }
  );

  server.tool(
    'list_routes',
    "List a trip's saved routes — named, day-scoped subsets of checkpoints (e.g. a " +
      '"Nature route" vs an "Anime route" covering the same day with different stops).',
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listRoutes(tripId))
  );

  server.tool(
    'get_route',
    'Get a single route by id.',
    { tripId: z.string(), routeId: z.string() },
    async ({ tripId, routeId }) => json(await repo.getRoute(tripId, routeId))
  );

  server.tool(
    'add_route',
    'Add a new route to a trip — a name, the day(s) it covers, and the subset of existing ' +
      'checkpoint ids it includes. A checkpoint may belong to more than one route.',
    { tripId: z.string(), route: routeInputSchema },
    async ({ tripId, route }) => json(await repo.addRoute(tripId, route))
  );

  server.tool(
    'update_route',
    'Edit fields on an existing route.',
    { tripId: z.string(), routeId: z.string(), changes: routeInputSchema.partial() },
    async ({ tripId, routeId, changes }) => {
      await repo.updateRoute(tripId, routeId, changes);
      return json({ ok: true });
    }
  );

  server.tool(
    'list_wiki_sections',
    'List a trip\'s "Trip Wiki" sections, sorted by order. Call this before ' +
      'add_wiki_section — if a similarly-titled section already exists (e.g. "Day 3" vs a new ' +
      '"Day 3 - Kyoto"), update the existing one with update_wiki_section instead of creating ' +
      'a near-duplicate.',
    { tripId: z.string() },
    async ({ tripId }) => json(await repo.listWikiSections(tripId))
  );

  server.tool(
    'get_wiki_section',
    'Get a single wiki section by id.',
    { tripId: z.string(), sectionId: z.string() },
    async ({ tripId, sectionId }) => json(await repo.getWikiSection(tripId, sectionId))
  );

  server.tool(
    'add_wiki_section',
    'Add a new section to a trip\'s "Trip Wiki". Call list_wiki_sections first and ' +
      'prefer update_wiki_section on an existing section (matched by title) over creating a ' +
      'near-duplicate.',
    { tripId: z.string(), section: wikiSectionInputSchema },
    async ({ tripId, section }) => json(await repo.addWikiSection(tripId, section))
  );

  server.tool(
    'update_wiki_section',
    'Edit fields on an existing wiki section. Call list_wiki_sections first and prefer this ' +
      'over add_wiki_section when a section covering the same topic already exists.',
    { tripId: z.string(), sectionId: z.string(), changes: wikiSectionInputSchema.partial() },
    async ({ tripId, sectionId, changes }) => {
      await repo.updateWikiSection(tripId, sectionId, changes);
      return json({ ok: true });
    }
  );
}
