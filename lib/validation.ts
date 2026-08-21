import { z } from "zod";

export const userSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre válido"),
  email: z.string().trim().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["ADMIN", "ADMINISTRACION", "VENTAS", "PRODUCCION", "CORTE", "ARMADO", "DEPOSITO"]),
  active: z.boolean().default(true),
});

export const productSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá un nombre válido"),
  categoria: z.enum(["SIMPLE", "DVH", "TEMPLADO", "PULIDO", "SOLO_CORTE", "DISTRIBUCION"]),
  precioM2: z.coerce.number().positive("Debe ser mayor a cero"),
  precioMl: z.union([z.coerce.number().positive(), z.literal(""), z.null()]).optional(),
  vigenteDesde: z.string().min(1, "Seleccioná una fecha"),
});

export const workOrderStatusSchema = z.object({
  status: z.enum(["PENDIENTE", "EN_PROCESO", "TERMINADA", "ANULADA"]),
});
