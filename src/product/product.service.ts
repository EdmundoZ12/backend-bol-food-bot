import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crear producto CON imágenes
   */
  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ): Promise<Product> {
    // 1. Crear el producto
    const product = this.productRepository.create(createProductDto);
    await this.productRepository.save(product);

    // 2. Subir imágenes a Cloudinary si hay archivos
    if (files && files.length > 0) {
      const imageUrls = await this.cloudinaryService.uploadMultipleImages(
        files,
      );

      // 3. Crear registros de ProductImage
      const productImages = imageUrls.map((url, index) => {
        return this.productImageRepository.create({
          url,
          isPrimary: index === 0,
          orderPosition: index,
          product,
        });
      });

      await this.productImageRepository.save(productImages);
    }

    return this.findOne(product.id);
  }

  /**
   * Agregar imágenes a un producto existente
   */
  async addImages(
    productId: string,
    files: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.findOne(productId);

    if (files && files.length > 0) {
      const imageUrls = await this.cloudinaryService.uploadMultipleImages(
        files,
      );

      const currentImagesCount = product.images.length;

      const productImages = imageUrls.map((url, index) => {
        return this.productImageRepository.create({
          url,
          isPrimary: currentImagesCount === 0 && index === 0,
          orderPosition: currentImagesCount + index,
          product,
        });
      });

      await this.productImageRepository.save(productImages);
    }

    return this.findOne(productId);
  }

  /**
   * Obtener todos los productos (para admin)
   */
  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['images'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtener solo productos disponibles (para el bot)
   */
  async findAllAvailable(): Promise<Product[]> {
    return this.productRepository.find({
      where: { available: true },
      relations: ['images'],
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Obtener productos por categoría (para el bot)
   */
  async findByCategory(category: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { category, available: true },
      relations: ['images'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtener todas las categorías únicas (para el menú del bot)
   */
  async getCategories(): Promise<string[]> {
    const result = await this.productRepository
      .createQueryBuilder('product')
      .select('DISTINCT product.category', 'category')
      .where('product.available = :available', { available: true })
      .orderBy('product.category', 'ASC')
      .getRawMany();

    return result.map((r) => r.category);
  }

  /**
   * Obtener un producto con sus imágenes
   */
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Verificar si un producto está disponible
   */
  async isAvailable(id: string): Promise<boolean> {
    const product = await this.productRepository.findOne({
      where: { id },
      select: ['id', 'available'], // ← Agregar 'id' aquí
    });

    return product?.available || false;
  }

  /**
   * Actualizar producto
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    await this.productRepository.save(product);
    return this.findOne(id);
  }

  /**
   * Cambiar disponibilidad de un producto
   */
  async toggleAvailability(id: string): Promise<Product> {
    const product = await this.findOne(id);
    product.available = !product.available;
    await this.productRepository.save(product);
    return product;
  }

  /**
   * Establecer disponibilidad
   */
  async setAvailability(id: string, available: boolean): Promise<Product> {
    const product = await this.findOne(id);
    product.available = available;
    await this.productRepository.save(product);
    return product;
  }

  /**
   * Eliminar producto
   */
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  /**
   * Eliminar una imagen específica
   */
  async removeImage(imageId: string): Promise<void> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    await this.productImageRepository.remove(image);
  }

  /**
   * Buscar productos por nombre (para búsqueda en el bot)
   */
  async searchByName(query: string): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.available = :available', { available: true })
      .andWhere('LOWER(product.name) LIKE LOWER(:query)', {
        query: `%${query}%`,
      })
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  /**
   * Obtener productos más vendidos (opcional, para después)
   */
  async getMostPopular(limit: number = 10): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoin('product.orderItems', 'orderItems')
      .where('product.available = :available', { available: true })
      .groupBy('product.id')
      .orderBy('COUNT(orderItems.id)', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Obtener precio de un producto (útil para cálculos)
   */
  async getPrice(id: string): Promise<number> {
    const product = await this.productRepository.findOne({
      where: { id },
      select: ['price'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product.price;
  }
}
