import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTripStore } from '../../store/tripStore';
import { computeBudgetTotal } from '../../utils/budgetTotals';
import { formatMoney, COMMON_CURRENCY_CODES } from '../../utils/currency';
import { BudgetDetailView } from './BudgetDetailView';
import type { Budget } from '../../types';

const PREFERRED_CURRENCY_KEY = 'trip-planner:preferredCurrency';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Editing = { id: 'new' };

export function BudgetsView({ open, onClose }: Props) {
  const budgets = useTripStore((s) => s.budgets);
  const budgetSections = useTripStore((s) => s.budgetSections);
  const budgetItems = useTripStore((s) => s.budgetItems);
  const addBudget = useTripStore((s) => s.addBudget);
  const deleteBudget = useTripStore((s) => s.deleteBudget);
  const budgetNavigationTarget = useTripStore((s) => s.budgetNavigationTarget);

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formName, setFormName] = useState('');
  const [formCurrency, setFormCurrency] = useState(
    () => localStorage.getItem(PREFERRED_CURRENCY_KEY) ?? 'JPY'
  );
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  const sortedBudgets = [...budgets].sort((a, b) => a.name.localeCompare(b.name));

  // A wiki link to a budget/budget item sets this in the store; jump straight
  // to that budget's detail view (and, for an item link, highlight it) rather
  // than landing on the list.
  useEffect(() => {
    if (!budgetNavigationTarget) return;
    setSelectedBudgetId(budgetNavigationTarget.budgetId);
    setHighlightItemId(budgetNavigationTarget.itemId);
  }, [budgetNavigationTarget]);

  function startAdd() {
    setEditing({ id: 'new' });
    setFormName('');
    setFormCurrency(localStorage.getItem(PREFERRED_CURRENCY_KEY) ?? 'JPY');
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!formName.trim() || !formCurrency.trim()) return;
    localStorage.setItem(PREFERRED_CURRENCY_KEY, formCurrency.trim());
    await addBudget({ name: formName.trim(), currency: formCurrency.trim() });
    setEditing(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteBudget(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleClose() {
    setSelectedBudgetId(null);
    setHighlightItemId(null);
    setEditing(null);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
        {selectedBudgetId ? (
          <>
            <DialogContent sx={{ pt: 3 }}>
              <BudgetDetailView
                budgetId={selectedBudgetId}
                onBack={() => {
                  setSelectedBudgetId(null);
                  setHighlightItemId(null);
                }}
                highlightItemId={highlightItemId}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Close</Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>Budget</DialogTitle>
            <DialogContent>
              {sortedBudgets.length === 0 && editing === null && (
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  No budgets yet — add one to start planning costs.
                </Typography>
              )}

              <List disablePadding>
                {sortedBudgets.map((budget) => {
                  const total = computeBudgetTotal(budget, budgetSections, budgetItems);
                  return (
                    <Box key={budget.id}>
                      <ListItemButton
                        onClick={() => setSelectedBudgetId(budget.id)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <ListItemText
                          primary={budget.name}
                          secondary={formatMoney(total, budget.currency)}
                        />
                        <IconButton
                          size="small"
                          aria-label={`Delete ${budget.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(budget);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemButton>
                      <Divider />
                    </Box>
                  );
                })}
              </List>

              {editing?.id === 'new' && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    mt: sortedBudgets.length > 0 ? 2 : 1,
                  }}
                >
                  <TextField
                    label="Budget name"
                    size="small"
                    fullWidth
                    autoFocus
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                  <Autocomplete
                    freeSolo
                    options={[...COMMON_CURRENCY_CODES]}
                    value={formCurrency}
                    onInputChange={(_e, value) => setFormCurrency(value)}
                    renderInput={(params) => (
                      <TextField {...params} label="Currency" size="small" />
                    )}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => void handleSave()}
                      disabled={!formName.trim() || !formCurrency.trim()}
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
                <Button sx={{ mt: sortedBudgets.length > 0 ? 2 : 0 }} onClick={startAdd}>
                  + Add budget
                </Button>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete budget</DialogTitle>
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
