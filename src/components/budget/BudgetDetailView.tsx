import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTripStore } from '../../store/tripStore';
import { computeSectionSubtotal } from '../../utils/budgetTotals';
import { formatMoney } from '../../utils/currency';
import { BudgetCategoryIcon } from './BudgetCategoryIcon';
import { BudgetItemList } from './BudgetItemList';
import { MarkdownNotes } from '../shared/MarkdownNotes';
import { MarkdownNotesField } from '../shared/MarkdownNotesField';
import type { BudgetCategory, BudgetSection } from '../../types';

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  travel: 'Travel',
  hotel: 'Hotel',
  meals: 'Meals',
  merchandise: 'Merchandise',
  other: 'Other',
};

interface Props {
  budgetId: string;
  onBack(): void;
  highlightItemId?: string | null;
}

type Editing = { id: string } | { id: 'new' };

export function BudgetDetailView({ budgetId, onBack, highlightItemId }: Props) {
  const budgets = useTripStore((s) => s.budgets);
  const budgetSections = useTripStore((s) => s.budgetSections);
  const budgetItems = useTripStore((s) => s.budgetItems);
  const addBudgetSection = useTripStore((s) => s.addBudgetSection);
  const updateBudgetSection = useTripStore((s) => s.updateBudgetSection);
  const deleteBudgetSection = useTripStore((s) => s.deleteBudgetSection);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [formCategory, setFormCategory] = useState<BudgetCategory>('other');
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BudgetSection | null>(null);

  const budget = budgets.find((b) => b.id === budgetId);
  const sections = budgetSections
    .filter((s) => s.budgetId === budgetId)
    .sort((a, b) => a.order - b.order);

  if (!budget) return null;

  function startEdit(section: BudgetSection) {
    setEditing({ id: section.id });
    setFormCategory(section.category);
    setFormName(section.name);
    setFormPrice(section.price !== undefined ? String(section.price) : '');
    setFormNotes(section.notes ?? '');
  }

  function startAdd() {
    setEditing({ id: 'new' });
    setFormCategory('other');
    setFormName('');
    setFormPrice('');
    setFormNotes('');
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!editing || !formName.trim()) return;
    const price = formPrice.trim() === '' ? undefined : Number(formPrice);
    const notes = formNotes.trim() || undefined;

    if (editing.id === 'new') {
      const nextOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order)) + 1 : 0;
      await addBudgetSection({
        budgetId,
        category: formCategory,
        name: formName.trim(),
        price,
        notes,
        order: nextOrder,
      });
    } else {
      await updateBudgetSection(editing.id, {
        category: formCategory,
        name: formName.trim(),
        price,
        notes,
      });
    }
    setEditing(null);
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const target = sections[index + direction];
    const current = sections[index];
    if (!target || !current) return;
    await Promise.all([
      updateBudgetSection(current.id, { order: target.order }),
      updateBudgetSection(target.id, { order: current.order }),
    ]);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteBudgetSection(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" aria-label="Back to budgets" onClick={onBack}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6">{budget.name}</Typography>
      </Box>

      {sections.length === 0 && editing === null && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No sections yet — add one to start budgeting.
        </Typography>
      )}

      {sections.map((section, index) => {
        const subtotal = computeSectionSubtotal(
          section,
          budgetItems.filter((i) => i.budgetSectionId === section.id)
        );
        return (
          <Box key={section.id} sx={{ mb: 2 }}>
            {editing?.id === section.id ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    select
                    label="Category"
                    size="small"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as BudgetCategory)}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Section name"
                    size="small"
                    fullWidth
                    autoFocus
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </Box>
                <TextField
                  label="Flat subtotal"
                  size="small"
                  type="number"
                  helperText="Only used if this section has no items"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                />
                <MarkdownNotesField label="Notes" value={formNotes} onChange={setFormNotes} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => void handleSave()}
                    disabled={!formName.trim()}
                  >
                    Save
                  </Button>
                  <Button size="small" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BudgetCategoryIcon category={section.category} fontSize="small" />
                <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
                  {section.name} — {formatMoney(subtotal, budget.currency)}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={`Move ${section.name} up`}
                  disabled={index === 0}
                  onClick={() => void moveSection(index, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move ${section.name} down`}
                  disabled={index === sections.length - 1}
                  onClick={() => void moveSection(index, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Edit ${section.name}`}
                  onClick={() => startEdit(section)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Delete ${section.name}`}
                  onClick={() => setDeleteTarget(section)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            {editing?.id !== section.id && section.notes && (
              <Box sx={{ mt: 0.25 }}>
                <MarkdownNotes notes={section.notes} variant="body2" />
              </Box>
            )}
            {editing?.id !== section.id && (
              <BudgetItemList
                budgetSectionId={section.id}
                items={budgetItems.filter((i) => i.budgetSectionId === section.id)}
                currency={budget.currency}
                highlightItemId={highlightItemId}
              />
            )}
            {index < sections.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        );
      })}

      {editing?.id === 'new' && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            mt: sections.length > 0 ? 2 : 1,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              select
              label="Category"
              size="small"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as BudgetCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Section name"
              size="small"
              fullWidth
              autoFocus
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </Box>
          <TextField
            label="Flat subtotal"
            size="small"
            type="number"
            helperText="Only used if this section has no items"
            value={formPrice}
            onChange={(e) => setFormPrice(e.target.value)}
          />
          <MarkdownNotesField label="Notes" value={formNotes} onChange={setFormNotes} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleSave()}
              disabled={!formName.trim()}
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

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete section</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete "{deleteTarget?.name}"? This can't be undone.
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
