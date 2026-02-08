import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createPropertyType, updatePropertyType, fetchPropertyTypeById } from '../../store/slices/propertyTypesSlice';
import { X, Plus, Trash2, ChevronRight, ChevronLeft, Bed, Home } from 'lucide-react';
import { toast } from 'react-toastify';

export default function PropertyTypeModal({ type, onClose }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    property_category: 'apartment',
    max_capacity: 1,
    rooms: [],
    spaces: []
  });



  useEffect(() => {
    if (type?.id) {
      setLoading(true);
      dispatch(fetchPropertyTypeById(type.id))
        .unwrap()
        .then((data) => {
          setFormData({
            name: data.name || '',
            description: data.description || '',
            property_category: data.property_category || 'apartment',
            max_capacity: data.max_capacity || 1,
            rooms: data.rooms || [],
            spaces: data.spaces || []
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [type, dispatch]);

  // Auto-generate name when rooms or category changes
  useEffect(() => {
    if (formData.rooms.length > 0 || formData.property_category) {
      const autoName = generateAutoName();
      if (autoName) {
        setFormData(prev => ({ ...prev, name: autoName }));
      }
    }
  }, [formData.rooms, formData.property_category]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseInt(value) || 0 : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
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

  // Validation for step 2 (rooms)
  const validateStep2 = () => {
    if (formData.rooms.length === 0) {
      toast.error('Debes agregar al menos una habitación');
      return false;
    }
    const hasAtLeastOneBed = formData.rooms.some(room =>
      room.beds && room.beds.length > 0
    );
    if (!hasAtLeastOneBed) {
      toast.error('Debes seleccionar al menos un tipo de cama');
      return false;
    }
    return true;
  };

  // Helper functions for auto-generating names
  const getCategoryLabel = (category) => {
    const labels = {
      hotel_room: 'Habitación Hotel',
      apartment: 'Apartamento',
      house: 'Casa',
      suite: 'Suite',
      other: 'Otro'
    };
    return labels[category] || category;
  };

  const getBedTypeLabel = (bedType) => {
    const labels = {
      single: 'cama sencilla',
      double: 'cama doble',
      queen: 'cama queen',
      king: 'cama king',
      sofa_bed: 'sofa cama'
    };
    return labels[bedType] || bedType;
  };

  const pluralizeBed = (quantity, bedType) => {
    const label = getBedTypeLabel(bedType);
    if (quantity === 1) return `${quantity} ${label}`;
    return `${quantity} ${label.replace('cama', 'camas')}`;
  };

  const generateAutoName = () => {
    if (!formData.property_category || formData.rooms.length === 0) return '';

    const category = getCategoryLabel(formData.property_category);

    const roomDescriptions = formData.rooms
      .filter(room => room.beds && room.beds.length > 0)
      .map(room => {
        const bedList = room.beds
          .map(bed => pluralizeBed(bed.quantity, bed.type))
          .join('-');
        return `1 habitacion/${bedList}`;
      });

    const allBeds = {};
    formData.rooms.forEach(room => {
      (room.beds || []).forEach(bed => {
        allBeds[bed.type] = (allBeds[bed.type] || 0) + bed.quantity;
      });
    });

    const bedSummary = Object.entries(allBeds)
      .map(([type, quantity]) => pluralizeBed(quantity, type))
      .join('-');

    let finalName = `${category} ${roomDescriptions.join(', ')}-${bedSummary}`;

    // Truncate if exceeds 250 characters
    if (finalName.length > 250) {
      finalName = finalName.substring(0, 247) + '...';
    }

    return finalName;
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
        rooms: formatRoomsForBackend(formData.rooms)
      };

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
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50 text-gray-600 cursor-not-allowed"
                          placeholder="Se generará automáticamente"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Se genera automáticamente según la categoría y habitaciones
                        </p>
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad de Personas (Adultos) *
                      </label>
                      <input
                        type="number"
                        name="max_capacity"
                        value={formData.max_capacity}
                        onChange={handleChange}
                        min="1"
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="Ej: 4"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Capacidad máxima de adultos (sin incluir niños o infantes)
                      </p>
                    </div>
                  </div>
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

                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Plus size={16} />
                  Agregar Habitación
                </button>
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

                <button
                  type="button"
                  onClick={handleAddSpace}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  <Plus size={16} />
                  Agregar Área
                </button>
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
                        <dt className="font-medium text-gray-700 w-32">Capacidad:</dt>
                        <dd className="text-gray-900">{formData.max_capacity} personas (adultos)</dd>
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
                onClick={() => {
                  if (step === 2 && !validateStep2()) return;
                  setStep(step + 1);
                }}
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
