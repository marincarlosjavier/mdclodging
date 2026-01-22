-- PROPERTY TYPES TABLE (Tipos de Propiedades/Apartamentos)
CREATE TABLE IF NOT EXISTS property_types (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    property_category VARCHAR(50) NOT NULL
        CHECK (property_category IN ('hotel_room', 'apartment', 'house', 'suite', 'other')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- PROPERTY TYPE ROOMS TABLE (Habitaciones de cada tipo)
CREATE TABLE IF NOT EXISTS property_type_rooms (
    id SERIAL PRIMARY KEY,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    room_name VARCHAR(100) NOT NULL,
    room_order INTEGER DEFAULT 1,

    -- Muebles para dormir
    single_beds INTEGER DEFAULT 0,
    double_beds INTEGER DEFAULT 0,
    queen_beds INTEGER DEFAULT 0,
    king_beds INTEGER DEFAULT 0,
    sofa_beds INTEGER DEFAULT 0,

    -- Otros muebles
    sofas INTEGER DEFAULT 0,
    armchairs INTEGER DEFAULT 0,

    -- Amenidades
    has_bathroom BOOLEAN DEFAULT false,
    has_tv BOOLEAN DEFAULT false,
    has_closet BOOLEAN DEFAULT false,
    has_air_conditioning BOOLEAN DEFAULT false,

    -- Blancos (inventario por defecto)
    default_towels INTEGER DEFAULT 0,
    default_sheets_sets INTEGER DEFAULT 0,
    default_pillows INTEGER DEFAULT 0,
    default_blankets INTEGER DEFAULT 0,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PROPERTY TYPE SPACES TABLE (Espacios comunes)
CREATE TABLE IF NOT EXISTS property_type_spaces (
    id SERIAL PRIMARY KEY,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    space_type VARCHAR(50) NOT NULL
        CHECK (space_type IN ('kitchen', 'living_room', 'dining_room', 'terrace', 'balcony', 'laundry', 'other')),
    space_name VARCHAR(100),
    description TEXT,

    -- Amenidades de cocina
    has_stove BOOLEAN DEFAULT false,
    has_refrigerator BOOLEAN DEFAULT false,
    has_microwave BOOLEAN DEFAULT false,
    has_dishwasher BOOLEAN DEFAULT false,

    -- Amenidades de comedor/sala
    has_dining_table BOOLEAN DEFAULT false,
    dining_capacity INTEGER,

    -- Amenidades de lavandería
    has_washer BOOLEAN DEFAULT false,
    has_dryer BOOLEAN DEFAULT false,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_property_types_tenant ON property_types(tenant_id);
CREATE INDEX idx_property_types_active ON property_types(is_active);
CREATE INDEX idx_property_types_category ON property_types(property_category);

CREATE INDEX idx_property_type_rooms_type ON property_type_rooms(property_type_id);
CREATE INDEX idx_property_type_rooms_order ON property_type_rooms(property_type_id, room_order);

CREATE INDEX idx_property_type_spaces_type ON property_type_spaces(property_type_id);
CREATE INDEX idx_property_type_spaces_space_type ON property_type_spaces(space_type);

-- Add comments
COMMENT ON TABLE property_types IS 'Master configuration of property types (apartments, rooms, houses)';
COMMENT ON COLUMN property_types.tenant_id IS 'Reference to tenant (hotel/business)';
COMMENT ON COLUMN property_types.property_category IS 'Category: hotel_room, apartment, house, suite, other';

COMMENT ON TABLE property_type_rooms IS 'Bedrooms/rooms within each property type';
COMMENT ON COLUMN property_type_rooms.room_order IS 'Display order for rooms';
COMMENT ON COLUMN property_type_rooms.default_towels IS 'Default number of towels for this room';
COMMENT ON COLUMN property_type_rooms.default_sheets_sets IS 'Default number of sheet sets for this room';

COMMENT ON TABLE property_type_spaces IS 'Common areas (kitchen, living room, terrace, etc.)';
COMMENT ON COLUMN property_type_spaces.space_type IS 'Type of space: kitchen, living_room, dining_room, terrace, balcony, laundry, other';
