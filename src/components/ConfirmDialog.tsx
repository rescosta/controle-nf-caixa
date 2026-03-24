import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger = false }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-md">
      <p className="text-slate-300">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
