-- Cambios aditivos: no elimina ni modifica datos existentes.
ALTER TABLE `Quote`
  ADD COLUMN `titulo` VARCHAR(160) NULL,
  ADD COLUMN `motivoRechazo` VARCHAR(500) NULL,
  ADD COLUMN `rechazadoAt` DATETIME(3) NULL,
  ADD COLUMN `rechazadoPorId` VARCHAR(191) NULL;

ALTER TABLE `Invoice`
  ADD COLUMN `quoteId` VARCHAR(191) NULL;

CREATE INDEX `Quote_fecha_clientId_idx` ON `Quote`(`fecha`, `clientId`);
CREATE INDEX `Quote_rechazadoPorId_idx` ON `Quote`(`rechazadoPorId`);
CREATE INDEX `Invoice_quoteId_idx` ON `Invoice`(`quoteId`);

-- Backfill seguro de facturas históricas: Invoice -> WorkOrder -> Quote.
UPDATE `Invoice` i
INNER JOIN `WorkOrder` w ON w.`id` = i.`workOrderId`
SET i.`quoteId` = w.`quoteId`
WHERE i.`quoteId` IS NULL;

ALTER TABLE `Quote`
  ADD CONSTRAINT `Quote_rechazadoPorId_fkey`
  FOREIGN KEY (`rechazadoPorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Invoice`
  ADD CONSTRAINT `Invoice_quoteId_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
