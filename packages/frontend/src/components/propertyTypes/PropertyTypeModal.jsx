import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createPropertyType, updatePropertyType, fetchPropertyTypeById } from '../../store/slices/propertyTypesSlice';
import { fetchCatalogItems, createCatalogItem } from '../../store/slices/catalogSlice';
import { X, Plus, Trash2, ChevronRight, ChevronLeft, Bed, Home } from 'lucide-react';
import { toast } from 'react-toastify';

// Helper function to generate unit names based on nomenclature settings
const generateUnitNames = (count, nomenclatureType, prefix, start) => {
  const names = [];
  if (nomenclatureType === 'numeric') {
    for (let i = 0; i < count; i++) {
      names.push(`${prefix}${start + i}`);
    }
  } else if (nomenclatureType === 'alphabetic') {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < count && i < 26; i++) {
      names.push(`${prefix}${letters[i]}`);
    }
  } else {
    // custom - just empty strings that user will fill
    for (let i = 0; i < count; i++) {
      names.push('');
    }
  }
  return names;
};

export default function PropertyTypeModal({ type, onClose }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState({
    departments: [],
    allCities: [],  // All cities, unfiltered
    allZones: []    // All zones, unfiltered
  });
  const [showQuickCreate, setShowQuickCreate] = useState(null); // 'department', 'city', 'zone', or null
  const [quickCreateData, setQuickCreateData] = useState({ name: '', description: '' });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    property_category: 'apartment',
    department_id: '',
    city_id: '',
    zone_id: '',
    room_count: 1,
    room_nomenclature_type: 'numeric',
    room_nomenclature_prefix: '',
    room_nomenclature_start: 101,
    room_nomenclature_examples: '',
    unit_names: [''],  // Array of individual unit names
    rooms: [],
    spaces: []
  });

  // Load catalog items on mount
  useEffect(() => {
    const loadCatalogItems = async () => {
      try {
        const [departmentsRes, citiesRes, zonesRes] = await Promise.all([
          dispatch(fetchCatalogItems({ category: 'location', type: 'department' })).unwrap(),
          dispatch(fetchCatalogItems({ category: 'location', type: 'city' })).unwrap(),
          dispatch(fetchCatalogItems({ category: 'location', type: 'zone' })).unwrap()
        ]);

        setCatalogItems({
          departments: departmentsRes,
          allCities: citiesRes,
          allZones: zonesRes
        });
      } catch (error) {
        console.error('Error loading catalog items:', error);
      }
    };

    loadCatalogItems();
  }, [dispatch]);

  // Filtered lists based on parent selection
  const filteredCities = formData.department_id
    ? catalogItems.allCities.filter(city => city.parent_id === parseInt(formData.department_id))
    : [];

  const filteredZones = formData.city_id
    ? catalogItems.allZones.filter(zone => zone.parent_id === parseInt(formData.city_id))
    : [];

  // Handle quick create of catalog items
  const handleQuickCreate = async () => {
    if (!quickCreateData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      let parent_id = null;
      if (showQuickCreate === 'city' && formData.department_id) {
        parent_id = parseInt(formData.department_id);
      } else if (showQuickCreate === 'zone' && formData.city_id) {
        parent_id = parseInt(formData.city_id);
      }

      const newItem = await dispatch(createCatalogItem({
        category: 'location',
        type: showQuickCreate,
        name: quickCreateData.name,
        description: quickCreateData.description,
        parent_id
      })).unwrap();

      toast.success(`${showQuickCreate === 'department' ? 'Departamento' : showQuickCreate === 'city' ? 'Ciudad' : 'Zona'} creado correctamente`);

      // Reload catalog items
      const [departmentsRes, citiesRes, zonesRes] = await Promise.all([
        dispatch(fetchCatalogItems({ category: 'location', type: 'department' })).unwrap(),
        dispatch(fetchCatalogItems({ category: 'location', type: 'city' })).unwrap(),
        dispatch(fetchCatalogItems({ category: 'location', type: 'zone' })).unwrap()
      ]);

      setCatalogItems({
        departments: departmentsRes,
        allCities: citiesRes,
        allZones: zonesRes
      });

      // Auto-select the newly created item
      if (showQuickCreate === 'department') {
        setFormData(prev => ({ ...prev, department_id: newItem.item.id }));
      } else if (showQuickCreate === 'city') {
        setFormData(prev => ({ ...prev, city_id: newItem.item.id }));
      } else if (showQuickCreate === 'zone') {
        setFormData(prev => ({ ...prev, zone_id: newItem.item.id }));
      }

      // Close quick create modal
      setShowQuickCreate(null);
      setQuickCreateData({ name: '', description: '' });
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  useEffect(() => {
    if (type?.id) {
      setLoading(true);
      dispatch(fetchPropertyTypeById(type.id))
        .unwrap()
        .then((data) => {
          // Convert room_nomenclature_examples back to unit_names array
          const unitNames = data.room_nomenclature_examples
            ? data.room_nomenclature_examples.split(',').map(name => name.trim())
            : generateUnitNames(
                data.room_count || 1,
                data.room_nomenclature_type || 'numeric',
                data.room_nomenclature_prefix || '',
                data.room_nomenclature_start || 101
              );

          setFormData({
            name: data.name || '',
            description: data.description || '',
            property_category: data.property_category || 'apartment',
            department_id: data.department_id || '',
            city_id: data.city_id || '',
            zone_id: data.zone_id || '',
            room_count: data.room_count || 1,
            room_nomenclature_type: data.room_nomenclature_type || 'numeric',
            room_nomenclature_prefix: data.room_nomenclature_prefix || '',
            room_nomenclature_start: data.room_nomenclature_start || 101,
            room_nomenclature_examples: data.room_nomenclature_examples || '',
            unit_names: unitNames,
            rooms: data.rooms || [],
            spaces: data.spaces || []
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [type, dispatch]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseInt(value) || 0 : value;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };

      // Clear child selections when parent changes
      if (name === 'department_id') {
        updated.city_id = '';
        updated.zone_id = '';
      } else if (name === 'city_id') {
        updated.zone_id = '';
      }

      // Auto-regenerate unit names when relevant fields change
      if (name === 'room_count' || name === 'room_nomenclature_type' ||
          name === 'room_nomenclature_prefix' || name === 'room_nomenclature_start') {
        const count = name === 'room_count' ? newValue : prev.room_count;
        const nomenclatureType = name === 'room_nomenclature_type' ? newValue : prev.room_nomenclature_type;
        const prefix = name === 'room_nomenclature_prefix' ? newValue : prev.room_nomenclature_prefix;
        const start = name === 'room_nomenclature_start' ? newValue : prev.room_nomenclature_start;

        updated.unit_names = generateUnitNames(count, nomenclatureType, prefix, start);
      }

      return updated;
    });
  };

  const handleUnitNameChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      unit_names: prev.unit_names.map((name, i) => i === index ? value : name)
    }));
  };

  const handleAddRoom = () => {
    setFormData(prev => ({
      ...prev,
      rooms: [...prev.rooms, {
        room_name: '',
        beds: [],  // Array of {type, quantity}
        sofas: 0,
        armchairs: 0,
        has_bathroom: false,
        has_tv: false,
        has_closet: false,
        has_air_conditioning: false,
        default_bath_towels: 0,
        default_hand_towels: 0,
        default_bath_mats: 0,
        default_sheets_sets: 0,
        default_standard_pillows: 0,
        default_decorative_pillows: 0,
        default_blankets: 0,
        notes: ''
      }]
    }));
  };

  const handleRemoveRoom = (index) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter((_, i) => i !== index)
    }));
  };

  const handleRoomChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === index ? { ...room, [field]: value } : room
      )
    }));
  };

  const handleAddBed = (roomIndex) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex ? {
          ...room,
          beds: [...(room.beds || []), { type: 'single', quantity: 1 }]
        } : room
      )
    }));
  };

  const handleRemoveBed = (roomIndex, bedIndex) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex ? {
          ...room,
          beds: room.beds.filter((_, bi) => bi !== bedIndex)
        } : room
      )
    }));
  };

  const handleBedChange = (roomIndex, bedIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map((room, i) =>
        i === roomIndex ? {
          ...room,
          beds: room.beds.map((bed, bi) =>
            bi === bedIndex ? { ...bed, [field]: value } : bed
          )
        } : room
      )
    }));
  };

  const handleAddSpace = () => {
    setFormData(prev => ({
      ...prev,
      spaces: [...prev.spaces, {
        space_type: 'kitchen',
        space_name: '',
        description: '',
        has_stove: false,
        has_refrigerator: false,
        has_microwave: false,
        has_dishwasher: false,
        has_dining_table: false,
        dining_capacity: 0,
        has_washer: false,
        has_dryer: false,
        notes: ''
      }]
    }));
  };

  const handleRemoveSpace = (index) => {
    setFormData(prev => ({
      ...prev,
      spaces: prev.spaces.filter((_, i) => i !== index)
    }));
  };

  const handleSpaceChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      spaces: prev.spaces.map((space, i) =>
        i === index ? { ...space, [field]: value } : space
      )
    }));
  };

  // Convert beds array to individual fields for backend compatibility
  const formatRoomsForBackend = (rooms) => {
    return rooms.map(room => {
      const bedCounts = {
        single_beds: 0,
        double_beds: 0,
        queen_beds: 0,
        king_beds: 0,
        sofa_beds: 0
      };

      (room.beds || []).forEach(bed => {
        if (bed.type === 'single') bedCounts.single_beds += bed.quantity;
        else if (bed.type === 'double') bedCounts.double_beds += bed.quantity;
        else if (bed.type === 'queen') bedCounts.queen_beds += bed.quantity;
        else if (bed.type === 'king') bedCounts.king_beds += bed.quantity;
        else if (bed.type === 'sofa_bed') bedCounts.sofa_beds += bed.quantity;
      });

      return {
        room_name: room.room_name,
        ...bedCounts,
        sofas: room.sofas || 0,
        armchairs: room.armchairs || 0,
        has_bathroom: room.has_bathroom || false,
        has_tv: room.has_tv || false,
        has_closet: room.has_closet || false,
        has_air_conditioning: room.has_air_conditioning || false,
        default_bath_towels: room.default_bath_towels || 0,
        default_hand_towels: room.default_hand_towels || 0,
        default_bath_mats: room.default_bath_mats || 0,
        default_sheets_sets: room.default_sheets_sets || 0,
        default_standard_pillows: room.default_standard_pillows || 0,
        default_decorative_pillows: room.default_decorative_pillows || 0,
        default_blankets: room.default_blankets || 0,
        notes: room.notes || null
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.property_category) {
      toast.error('Nombre y categoría son requeridos');
      return;
    }

    try {
      setLoading(true);
      const submitData = {
        ...formData,
        rooms: formatRoomsForBackend(formData.rooms),
        // Convert unit_names array to comma-separated string
        room_nomenclature_examples: formData.unit_names.join(', ')
      };
      // Remove unit_names as it's not a backend field
      delete submitData.unit_names;

      if (type?.id) {
        await dispatch(updatePropertyType({ id: type.id, data: submitData })).unwrap();
        toast.success('Tipo de propiedad actualizado correctamente');
      } else {
        await dispatch(createPropertyType(submitData)).unwrap();
        toast.success('Tipo de propiedad creado correctamente');
      }
      onClose();
    } catch (error) {
      // Error already handled
    } finally {
      setLoading(false);
    }
  };

  const generateNomenclatureExamples = () => {
    const count = Math.min(formData.room_count, 5);
    const examples = [];

    if (formData.room_nomenclature_type === 'numeric') {
      for (let i = 0; i < count; i++) {
        examples.push(`${formData.room_nomenclature_prefix}${formData.room_nomenclature_start + i}`);
      }
    } else if (formData.room_nomenclature_type === 'alphabetic') {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < count; i++) {
        examples.push(`${formData.room_nomenclature_prefix}${letters[i]}`);
      }
    }

    return examples.join(', ') + (formData.room_count > 5 ? '...' : '');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {type ? 'Editar Tipo de Propiedad' : 'Nuevo Tipo de Propiedad'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button">
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {['Configuración', 'Habitaciones', 'Áreas Comunes', 'Revisión'].map((label, index) => (
              <div key={index} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step > index + 1
                      ? 'bg-green-500 text-white'
                      : step === index + 1
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step > index + 1 ? '✓' : index + 1}
                </div>
                <span className={`ml-2 text-sm ${step === index + 1 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                  {label}
                </span>
                {index < 3 && <ChevronRight className="mx-2 text-gray-400" size={16} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Configuración */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Información Básica */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre del Tipo *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Ej: Apartamento Estándar"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Categoría *
                        </label>
                        <select
                          name="property_category"
                          value={formData.property_category}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="hotel_room">Habitación Hotel</option>
                          <option value="apartment">Apartamento</option>
                          <option value="house">Casa</option>
                          <option value="suite">Suite</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Descripción breve..."
                      />
                    </div>
                  </div>
                </div>

                {/* Ubicación */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubicación</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Selecciona desde el catálogo o crea uno nuevo con el botón +
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departamento
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="department_id"
                          value={formData.department_id}
                          onChange={handleChange}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          {catalogItems.departments.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickCreate('department');
                            setQuickCreateData({ name: '', description: '' });
                          }}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                          title="Crear nuevo departamento"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ciudad
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="city_id"
                          value={formData.city_id}
                          onChange={handleChange}
                          disabled={!formData.department_id}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {formData.department_id ? 'Seleccionar...' : 'Primero selecciona un departamento'}
                          </option>
                          {filteredCities.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.department_id) {
                              toast.warning('Primero selecciona un departamento');
                              return;
                            }
                            setShowQuickCreate('city');
                            setQuickCreateData({ name: '', description: '' });
                          }}
                          disabled={!formData.department_id}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                          title="Crear nueva ciudad"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Edificio/Zona
                      </label>
                      <div className="flex gap-2">
                        <select
                          name="zone_id"
                          value={formData.zone_id}
                          onChange={handleChange}
                          disabled={!formData.city_id}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {formData.city_id ? 'Seleccionar...' : 'Primero selecciona una ciudad'}
                          </option>
                          {filteredZones.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (!formData.city_id) {
                              toast.warning('Primero selecciona una ciudad');
                              return;
                            }
                            setShowQuickCreate('zone');
                            setQuickCreateData({ name: '', description: '' });
                          }}
                          disabled={!formData.city_id}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                          title="Crear nueva zona"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cantidad de Unidades y Nomenclatura */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Cantidad de Unidades y Nomenclatura</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad de Unidades *
                      </label>
                      <input
                        type="number"
                        name="room_count"
                        min="1"
                        value={formData.room_count}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Cuántas habitaciones/apartamentos hay de este tipo
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Nomenclatura *
                      </label>
                      <select
                        name="room_nomenclature_type"
                        value={formData.room_nomenclature_type}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="numeric">Numérica (101, 102, 103...)</option>
                        <option value="alphabetic">Alfabética (A, B, C...)</option>
                        <option value="custom">Personalizada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prefijo (opcional)
                      </label>
                      <input
                        type="text"
                        name="room_nomenclature_prefix"
                        value={formData.room_nomenclature_prefix}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="APT-, CASA-, etc."
                      />
                    </div>

                    {formData.room_nomenclature_type === 'numeric' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número Inicial
                        </label>
                        <input
                          type="number"
                          name="room_nomenclature_start"
                          value={formData.room_nomenclature_start}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    )}

                    {formData.room_nomenclature_type === 'custom' && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ejemplos de Nombres (separados por coma)
                        </label>
                        <input
                          type="text"
                          name="room_nomenclature_examples"
                          value={formData.room_nomenclature_examples}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                          placeholder="Casa Vista Mar, Casa del Sol, Casa Bella..."
                        />
                      </div>
                    )}
                  </div>

                  {formData.room_nomenclature_type !== 'custom' && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Vista previa: </span>
                        {generateNomenclatureExamples()}
                      </p>
                    </div>
                  )}

                  {/* Individual Unit Names */}
                  {formData.room_count > 0 && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Nomenclaturas Específicas
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Personaliza los nombres de cada unidad según tu preferencia
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {formData.unit_names.map((unitName, index) => (
                          <div key={index}>
                            <label className="block text-xs text-gray-600 mb-1">
                              Unidad {index + 1}
                            </label>
                            <input
                              type="text"
                              value={unitName}
                              onChange={(e) => handleUnitNameChange(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                              placeholder={`Ej: ${formData.room_nomenclature_prefix}${formData.room_nomenclature_type === 'numeric' ? formData.room_nomenclature_start + index : String.fromCharCode(65 + index)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Habitaciones (Cuartos) */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Habitaciones (Dormitorios)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configura las habitaciones/dormitorios que tiene este tipo de propiedad
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Plus size={16} />
                  Agregar Habitación
                </button>

                {formData.rooms.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    <Bed className="mx-auto mb-3 text-gray-400" size={48} />
                    <p>No hay habitaciones agregadas</p>
                    <p className="text-sm mt-1">Haz clic en "Agregar Habitación" para comenzar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.rooms.map((room, roomIndex) => (
                      <div key={roomIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900">Habitación {roomIndex + 1}</h4>
                          <button
                            type="button"
                            onClick={() => handleRemoveRoom(roomIndex)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nombre *
                            </label>
                            <input
                              type="text"
                              value={room.room_name}
                              onChange={(e) => handleRoomChange(roomIndex, 'room_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                              placeholder="Ej: Habitación Principal, Dormitorio 1"
                              required
                            />
                          </div>

                          {/* Beds Section */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Camas
                              </label>
                              <button
                                type="button"
                                onClick={() => handleAddBed(roomIndex)}
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                <Plus size={14} />
                                Agregar Cama
                              </button>
                            </div>

                            {(!room.beds || room.beds.length === 0) ? (
                              <p className="text-sm text-gray-500 italic py-2">Sin camas</p>
                            ) : (
                              <div className="space-y-2">
                                {room.beds.map((bed, bedIndex) => (
                                  <div key={bedIndex} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                    <select
                                      value={bed.type}
                                      onChange={(e) => handleBedChange(roomIndex, bedIndex, 'type', e.target.value)}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    >
                                      <option value="single">Individual</option>
                                      <option value="double">Doble</option>
                                      <option value="queen">Queen</option>
                                      <option value="king">King</option>
                                      <option value="sofa_bed">Sofá Cama</option>
                                    </select>
                                    <input
                                      type="number"
                                      min="1"
                                      value={bed.quantity}
                                      onChange={(e) => handleBedChange(roomIndex, bedIndex, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                      placeholder="Cant"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBed(roomIndex, bedIndex)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Baño Attached */}
                          <div className="border-t pt-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={room.has_bathroom || false}
                                onChange={(e) => handleRoomChange(roomIndex, 'has_bathroom', e.target.checked)}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Tiene baño privado
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Áreas Comunes */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Áreas Comunes</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configura las áreas comunes como cocina, sala, comedor, baños, patio, etc.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddSpace}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Plus size={16} />
                  Agregar Área
                </button>

                {formData.spaces.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                    <Home className="mx-auto mb-3 text-gray-400" size={48} />
                    <p>No hay áreas comunes agregadas</p>
                    <p className="text-sm mt-1">Haz clic en "Agregar Área" para comenzar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.spaces.map((space, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-gray-900">Área {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpace(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tipo de Área *
                            </label>
                            <select
                              value={space.space_type}
                              onChange={(e) => handleSpaceChange(index, 'space_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                              required
                            >
                              <option value="kitchen">Cocina</option>
                              <option value="living_room">Sala</option>
                              <option value="dining_room">Comedor</option>
                              <option value="bathroom">Baño</option>
                              <option value="terrace">Terraza/Patio</option>
                              <option value="balcony">Balcón</option>
                              <option value="laundry">Lavandería</option>
                              <option value="other">Otro</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nombre Personalizado
                            </label>
                            <input
                              type="text"
                              value={space.space_name || ''}
                              onChange={(e) => handleSpaceChange(index, 'space_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="Opcional"
                            />
                          </div>

                          {space.space_type === 'kitchen' && (
                            <div className="col-span-2">
                              <label className="block text-sm text-gray-700 mb-2">Electrodomésticos</label>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_stove || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_stove', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Estufa</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_refrigerator || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_refrigerator', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Refrigerador</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_microwave || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_microwave', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Microondas</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_dishwasher || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_dishwasher', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Lavavajillas</span>
                                </label>
                              </div>
                            </div>
                          )}

                          {(space.space_type === 'living_room' || space.space_type === 'dining_room') && (
                            <>
                              <div className="col-span-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_dining_table || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_dining_table', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Mesa de Comedor</span>
                                </label>
                              </div>
                              {space.has_dining_table && (
                                <div>
                                  <label className="block text-sm text-gray-700 mb-1">Capacidad</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={space.dining_capacity || ''}
                                    onChange={(e) => handleSpaceChange(index, 'dining_capacity', parseInt(e.target.value) || null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                    placeholder="Personas"
                                  />
                                </div>
                              )}
                            </>
                          )}

                          {space.space_type === 'laundry' && (
                            <div className="col-span-2">
                              <label className="block text-sm text-gray-700 mb-2">Electrodomésticos</label>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_washer || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_washer', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Lavadora</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={space.has_dryer || false}
                                    onChange={(e) => handleSpaceChange(index, 'has_dryer', e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">Secadora</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Revisión Final</h3>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Información Básica</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex">
                        <dt className="font-medium text-gray-700 w-32">Nombre:</dt>
                        <dd className="text-gray-900">{formData.name}</dd>
                      </div>
                      <div className="flex">
                        <dt className="font-medium text-gray-700 w-32">Categoría:</dt>
                        <dd className="text-gray-900">{formData.property_category}</dd>
                      </div>
                      <div className="flex">
                        <dt className="font-medium text-gray-700 w-32">Unidades:</dt>
                        <dd className="text-gray-900">{formData.room_count}</dd>
                      </div>
                      <div className="flex">
                        <dt className="font-medium text-gray-700 w-32">Nomenclatura:</dt>
                        <dd className="text-gray-900">
                          {formData.room_nomenclature_type === 'custom'
                            ? formData.room_nomenclature_examples
                            : generateNomenclatureExamples()}
                        </dd>
                      </div>
                      {formData.description && (
                        <div className="flex">
                          <dt className="font-medium text-gray-700 w-32">Descripción:</dt>
                          <dd className="text-gray-900">{formData.description}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Habitaciones ({formData.rooms.length})
                    </h4>
                    {formData.rooms.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay habitaciones agregadas</p>
                    ) : (
                      <div className="space-y-2">
                        {formData.rooms.map((room, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{room.room_name || `Habitación ${index + 1}`}</span>
                            {' - '}
                            <span className="text-gray-600">
                              {(room.beds || []).length > 0
                                ? room.beds.map(bed => `${bed.quantity} ${bed.type}`).join(', ')
                                : 'Sin camas'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Espacios Comunes ({formData.spaces.length})
                    </h4>
                    {formData.spaces.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay espacios agregados</p>
                    ) : (
                      <div className="space-y-2">
                        {formData.spaces.map((space, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{space.space_name || space.space_type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancelar
            </button>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                <ChevronLeft size={20} />
                Volver
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Siguiente
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {loading ? 'Guardando...' : type ? 'Actualizar' : 'Crear'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Create Location Modal */}
      {showQuickCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Crear {showQuickCreate === 'department' ? 'Departamento' : showQuickCreate === 'city' ? 'Ciudad' : 'Zona'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={quickCreateData.name}
                  onChange={(e) => setQuickCreateData({ ...quickCreateData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder={`Nombre del ${showQuickCreate === 'department' ? 'departamento' : showQuickCreate === 'city' ? 'ciudad' : 'zona'}`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={quickCreateData.description}
                  onChange={(e) => setQuickCreateData({ ...quickCreateData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Descripción opcional..."
                />
              </div>

              {showQuickCreate === 'city' && formData.department_id && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  Se creará en: <strong>{catalogItems.departments.find(d => d.id === parseInt(formData.department_id))?.name}</strong>
                </div>
              )}

              {showQuickCreate === 'zone' && formData.city_id && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  Se creará en: <strong>{catalogItems.allCities.find(c => c.id === parseInt(formData.city_id))?.name}</strong>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCreate(null);
                  setQuickCreateData({ name: '', description: '' });
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuickCreate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
