import { createContext, useContext } from 'react'

export type ToastKind = 'info' | 'error'
export type ShowToast = (message: string, kind?: ToastKind) => void

export const ToastContext = createContext<ShowToast>(() => {})

export const useToast = () => useContext(ToastContext)
