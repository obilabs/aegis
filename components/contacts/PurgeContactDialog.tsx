'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface PurgeContactDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  contactName: string
  isBulk?: boolean
}

export default function PurgeContactDialog({
  isOpen,
  onClose,
  onConfirm,
  contactName,
  isBulk = false,
}: PurgeContactDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [processing, setProcessing] = useState(false)

  const expectedText = isBulk ? 'PERMANENTLY DELETE' : contactName
  const isConfirmed = confirmation === expectedText

  function handleClose() {
    setConfirmation('')
    setProcessing(false)
    onClose()
  }

  async function handleConfirm() {
    if (!isConfirmed) return
    setProcessing(true)
    onConfirm()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-slate-800 border border-slate-700 p-6 shadow-xl transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Permanently Delete {isBulk ? contactName : `${contactName}?`}
                    </Dialog.Title>
                    <p className="text-sm text-red-400 mt-1">
                      This action cannot be undone. All data will be permanently removed.
                    </p>
                  </div>
                </div>

                <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <p className="text-sm text-slate-300">
                    {isBulk ? (
                      <>
                        You are about to permanently delete <span className="font-semibold text-white">{contactName}</span>.
                        This will remove all associated data that is not linked to other records.
                      </>
                    ) : (
                      <>
                        This will permanently delete <span className="font-semibold text-white">{contactName}</span> and
                        remove all associated data that is not linked to other records.
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-slate-400 mb-1">
                    Type{' '}
                    <span className="font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded text-xs">
                      {expectedText}
                    </span>
                    {' '}to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmation}
                    onChange={e => setConfirmation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    placeholder={expectedText}
                    autoComplete="off"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!isConfirmed || processing}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
