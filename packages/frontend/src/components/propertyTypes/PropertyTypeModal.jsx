import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createPropertyType, updatePropertyType, fetchPropertyTypeById } from '../../store/slices/propertyTypesSlice';
import { X, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    property_category: 'apartment',
    department: '',
    city: '',
    zone: '',
    room_count: 1,
    room_nomenclature_type: 'numeric',
    room_nomenclature_prefix: '',
    room_nomenclature_start: 101,
    room_nomenclature_examples: '',
    unit_names: [''],  // Array of individual unit names
    rooms: [],
    spaces: []
  });

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
            department: data.department || '',
            city: data.city || '',
            zone: data.zone || '',
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
            {['Información Básica', 'Habitaciones', 'Espacios Comunes', 'Revisión'].map((label, index) => (
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
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
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
                    placeholder="Ej: Apartamento Estándar, Habitación Doble..."
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Descripción detallada del tipo de propiedad..."
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-gray-900 mb-4">Ubicación</h4>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departamento
                      </label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Ej: Cesar, La Guajira..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Ej: Valledupar, Riohacha..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Edificio/Zona
                      </label>
                      <input
                        type="text"
                        name="zone"
                        value={formData.zone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Ej: Edificio Villa Olímpica..."
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-gray-900 mb-4">Nomenclatura de Habitaciones</h4>

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

            {/* Step 2: Rooms */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Habitaciones</h3>
                  <button
                    type="button"
                    onClick={handleAddRoom}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    <Plus size={16} />
                    Agregar Habitación
                  </button>
                </div>

                {formData.rooms.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay habitaciones agregadas. Haz clic en "Agregar Habitación" para comenzar.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {formData.rooms.map((room, roomIndex) => (
                      <div key={roomIndex} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">Habitación {roomIndex + 1}</h4>
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
                              Nombre de Habitación
                            </label>
                            <input
                              type="text"
                              value={room.room_name}
                              onChange={(e) => handleRoomChange(roomIndex, 'room_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              placeholder="Ej: Habitación Principal, Dormitorio 1..."
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
                              <p className="text-sm text-gray-500 italic">No hay camas agregadas</p>
                            ) : (
                              <div className="space-y-2">
                                {room.beds.map((bed, bedIndex) => (
                                  <div key={bedIndex} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
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

                          {/* Linens Section - Toallas */}
                          <div className="border-t pt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Toallas por Defecto
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Baño</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={room.default_bath_towels || 0}
                                  onChange={(e) => handleRoomChange(roomIndex, 'default_bath_towels', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Mano</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={room.default_hand_towels || 0}
                                  onChange={(e) => handleRoomChange(roomIndex, 'default_hand_towels', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Piso</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={room.default_bath_mats || 0}
                                  onChange={(e) => handleRoomChange(roomIndex, 'default_bath_mats', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Almohadas */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Almohadas por Defecto
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Estándar</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={room.default_standard_pillows || 0}
                                  onChange={(e) => handleRoomChange(roomIndex, 'default_standard_pillows', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Decorativas</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={room.default_decorative_pillows || 0}
                                  onChange={(e) => handleRoomChange(roomIndex, 'default_decorative_pillows', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Other Linens */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Juegos de Sábanas</label>
                              <input
                                type="number"
                                min="0"
                                value={room.default_sheets_sets || 0}
                                onChange={(e) => handleRoomChange(roomIndex, 'default_sheets_sets', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Cobijas/Cubrecamas</label>
                              <input
                                type="number"
                                min="0"
                                value={room.default_blankets || 0}
                                onChange={(e) => handleRoomChange(roomIndex, 'default_blankets', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                              />
                            </div>
                          </div>

                          {/* Amenities */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amenidades</label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={room.has_bathroom || false}
                                  onChange={(e) => handleRoomChange(roomIndex, 'has_bathroom', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm">Baño</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={room.has_tv || false}
                                  onChange={(e) => handleRoomChange(roomIndex, 'has_tv', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm">TV</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={room.has_closet || false}
                                  onChange={(e) => handleRoomChange(roomIndex, 'has_closet', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm">Closet</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={room.has_air_conditioning || false}
                                  onChange={(e) => handleRoomChange(roomIndex, 'has_air_conditioning', e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm">Aire Acondicionado</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Spaces - Keep existing */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Espacios Comunes</h3>
                  <button
                    type="button"
                    onClick={handleAddSpace}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    <Plus size={16} />
                    Agregar Espacio
                  </button>
                </div>

                {formData.spaces.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay espacios agregados. Haz clic en "Agregar Espacio" para comenzar.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.spaces.map((space, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-gray-900">Espacio {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpace(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tipo de Espacio
                            </label>
                            <select
                              value={space.space_type}
                              onChange={(e) => handleSpaceChange(index, 'space_type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                              <option value="kitchen">Cocina</option>
                              <option value="living_room">Sala</option>
                              <option value="dining_room">Comedor</option>
                              <option value="terrace">Terraza</option>
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
    </div>
  );
}
