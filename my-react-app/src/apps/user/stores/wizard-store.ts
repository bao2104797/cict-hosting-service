/**
 * Zustand store quản lý wizard state (auto-save vào localStorage)
 */
import { create } from "zustand"
import type { WizardData, DatabaseFormData, BackendFormData, FrontendFormData } from "@/types"

interface WizardStore extends WizardData {
  setProjectName: (name: string) => void
  setDescription: (desc: string) => void
  setProjectId: (id: number) => void
  addDatabase: (db: DatabaseFormData) => void
  removeDatabase: (index: number) => void
  updateDatabase: (index: number, db: DatabaseFormData) => void
  addBackend: (be: BackendFormData) => void
  removeBackend: (index: number) => void
  updateBackend: (index: number, be: BackendFormData) => void
  addFrontend: (fe: FrontendFormData) => void
  removeFrontend: (index: number) => void
  updateFrontend: (index: number, fe: FrontendFormData) => void
  setCurrentStep: (step: number) => void
  resetWizard: () => void
}

// Load từ localStorage
const loadWizardData = (): Partial<WizardData> => {
  try {
    const stored = localStorage.getItem("wizard-draft")
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error("Lỗi load wizard data:", error)
  }
  return {}
}

// Save vào localStorage
const saveWizardData = (data: WizardData) => {
  try {
    localStorage.setItem("wizard-draft", JSON.stringify(data))
  } catch (error) {
    console.error("Lỗi save wizard data:", error)
  }
}

const initialState: WizardData = {
  projectName: "",
  description: "",
  projectId: undefined, // Đảm bảo projectId không có trong initialState
  databases: [],
  backends: [],
  frontends: [],
  currentStep: 0,
}

const savedData = loadWizardData()

export const useWizardStore = create<WizardStore>((set, get) => {
  // Hàm set với auto-save
  const setWithSave = (updates: Partial<WizardData> | ((state: WizardData) => Partial<WizardData>)) => {
    set((state) => {
      const updatesData = typeof updates === 'function' ? updates(state) : updates
      const newState = { ...state, ...updatesData }
      saveWizardData(newState)
      return newState
    })
  }

  return {
    ...initialState,
    ...savedData,

    setProjectName: (name) => setWithSave({ projectName: name }),
    setDescription: (desc) => setWithSave({ description: desc }),
    setProjectId: (id) => setWithSave({ projectId: id }),

    addDatabase: (db) =>
      setWithSave((state) => ({
        databases: [...state.databases, db],
      })),

    removeDatabase: (index) =>
      setWithSave((state) => ({
        databases: state.databases.filter((_, i) => i !== index),
      })),

    updateDatabase: (index, db) =>
      setWithSave((state) => {
        const newDatabases = [...state.databases]
        newDatabases[index] = db
        return { databases: newDatabases }
      }),

    addBackend: (be) =>
      setWithSave((state) => ({
        backends: [...state.backends, be],
      })),

    removeBackend: (index) =>
      setWithSave((state) => ({
        backends: state.backends.filter((_, i) => i !== index),
      })),

    updateBackend: (index, be) =>
      setWithSave((state) => {
        const newBackends = [...state.backends]
        newBackends[index] = be
        return { backends: newBackends }
      }),

    addFrontend: (fe) =>
      setWithSave((state) => ({
        frontends: [...state.frontends, fe],
      })),

    removeFrontend: (index) =>
      setWithSave((state) => ({
        frontends: state.frontends.filter((_, i) => i !== index),
      })),

    updateFrontend: (index, fe) =>
      setWithSave((state) => {
        const newFrontends = [...state.frontends]
        newFrontends[index] = fe
        return { frontends: newFrontends }
      }),

    setCurrentStep: (step) => setWithSave({ currentStep: step }),

    resetWizard: () => {
      localStorage.removeItem("wizard-draft")
      set(initialState)
    },
  }
})

