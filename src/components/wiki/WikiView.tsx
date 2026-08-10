import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
  Collapse,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTripStore } from '../../store/tripStore';
import type { WikiSection } from '../../types';
import type { InternalLinkKind } from '../shared/MarkdownNotes';
import { MarkdownNotes } from '../shared/MarkdownNotes';
import { MarkdownNotesField } from '../shared/MarkdownNotesField';
import type { Linkable } from '../shared/MarkdownNotesField';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate(kind: InternalLinkKind, id: string): void;
}

type Editing = { id: string } | { id: 'new' };

// Sections shorter than this render in full; longer ones start collapsed to
// a peek height with a toggle to expand — long generated/pasted sections
// (e.g. a full day-by-day itinerary) shouldn't push every other section
// below the fold.
const LONG_SECTION_CHARS = 240;
const COLLAPSED_PEEK_HEIGHT = 72;

export function WikiView({ open, onClose, onNavigate }: Props) {
  const checkpoints = useTripStore((s) => s.checkpoints);
  const alternatives = useTripStore((s) => s.alternatives);
  const routes = useTripStore((s) => s.routes);
  const budgets = useTripStore((s) => s.budgets);
  const budgetItems = useTripStore((s) => s.budgetItems);
  const wikiSections = useTripStore((s) => s.wikiSections);
  const addWikiSection = useTripStore((s) => s.addWikiSection);
  const updateWikiSection = useTripStore((s) => s.updateWikiSection);
  const deleteWikiSection = useTripStore((s) => s.deleteWikiSection);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WikiSection | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sections = [...wikiSections].sort((a, b) => a.order - b.order);

  const linkables: Linkable[] = [
    ...checkpoints.map((c) => ({ id: c.id, label: c.name, kind: 'checkpoint' as const })),
    ...alternatives.map((a) => ({ id: a.id, label: a.name, kind: 'alternative' as const })),
    ...routes.map((r) => ({ id: r.id, label: r.name, kind: 'route' as const })),
    ...budgets.map((b) => ({ id: b.id, label: b.name, kind: 'budget' as const })),
    ...budgetItems.map((i) => ({ id: i.id, label: i.name, kind: 'budget_item' as const })),
  ];

  function startEdit(section: WikiSection) {
    setEditing({ id: section.id });
    setFormTitle(section.title);
    setFormContent(section.content);
  }

  function startAdd() {
    setEditing({ id: 'new' });
    setFormTitle('');
    setFormContent('');
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!editing || !formTitle.trim()) return;
    if (editing.id === 'new') {
      const nextOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order)) + 1 : 0;
      await addWikiSection({ title: formTitle.trim(), content: formContent, order: nextOrder });
    } else {
      await updateWikiSection(editing.id, { title: formTitle.trim(), content: formContent });
    }
    setEditing(null);
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const target = sections[index + direction];
    const current = sections[index];
    if (!target || !current) return;
    await Promise.all([
      updateWikiSection(current.id, { order: target.order }),
      updateWikiSection(target.id, { order: current.order }),
    ]);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteWikiSection(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleNavigate(kind: InternalLinkKind, id: string) {
    onClose();
    onNavigate(kind, id);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>Wiki</DialogTitle>
        <DialogContent>
          {sections.length === 0 && editing === null && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No sections yet — add one to get started.
            </Typography>
          )}

          {sections.map((section, index) => {
            const isLong = section.content.length > LONG_SECTION_CHARS;
            const isExpanded = expandedIds.has(section.id);
            return (
              <Box key={section.id} sx={{ mb: 2 }}>
                {editing?.id === section.id ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                    <TextField
                      label="Section title"
                      size="small"
                      fullWidth
                      autoFocus
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                    <MarkdownNotesField
                      label="Content"
                      value={formContent}
                      onChange={setFormContent}
                      linkables={linkables}
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => void handleSave()}
                        disabled={!formTitle.trim()}
                      >
                        Save
                      </Button>
                      <Button size="small" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
                        {section.title}
                      </Typography>
                      {isLong && (
                        <IconButton
                          size="small"
                          aria-label={
                            isExpanded ? `Collapse ${section.title}` : `Expand ${section.title}`
                          }
                          onClick={() => toggleExpanded(section.id)}
                        >
                          <ExpandMoreIcon
                            fontSize="small"
                            sx={{
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.15s',
                            }}
                          />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        aria-label={`Move ${section.title} up`}
                        disabled={index === 0}
                        onClick={() => void moveSection(index, -1)}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Move ${section.title} down`}
                        disabled={index === sections.length - 1}
                        onClick={() => void moveSection(index, 1)}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Edit ${section.title}`}
                        onClick={() => startEdit(section)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${section.title}`}
                        onClick={() => setDeleteTarget(section)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    {isLong ? (
                      <Collapse in={isExpanded} collapsedSize={COLLAPSED_PEEK_HEIGHT}>
                        <MarkdownNotes notes={section.content} onInternalLink={handleNavigate} />
                      </Collapse>
                    ) : (
                      <MarkdownNotes notes={section.content} onInternalLink={handleNavigate} />
                    )}
                    {isLong && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          onClick={() => toggleExpanded(section.id)}
                          sx={{ mt: 0.5 }}
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
                {index < sections.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Box>
            );
          })}

          {editing?.id === 'new' && (
            // mt is at least 1 even with no sections above (MUI zeroes
            // DialogContent's own top padding right after a DialogTitle,
            // which otherwise clips this field's floating label).
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                mt: sections.length > 0 ? 2 : 1,
              }}
            >
              <TextField
                label="Section title"
                size="small"
                fullWidth
                autoFocus
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
              <MarkdownNotesField
                label="Content"
                value={formContent}
                onChange={setFormContent}
                linkables={linkables}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void handleSave()}
                  disabled={!formTitle.trim()}
                >
                  Save
                </Button>
                <Button size="small" onClick={cancelEdit}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}

          {editing === null && (
            <Button sx={{ mt: sections.length > 0 ? 2 : 0 }} onClick={startAdd}>
              + Add section
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete section</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{deleteTarget?.title}"? This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={() => void handleConfirmDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
