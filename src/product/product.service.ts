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

  // Crear producto CON imágenes
  async create(
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ): Promise<Product> {
    // 1. Crear el producto (sin imágenes todavía)
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
          isPrimary: index === 0, // La primera es la imagen principal
          orderPosition: index,
          product,
        });
      });

      await this.productImageRepository.save(productImages);
    }

    // 4. Retornar producto con imágenes
    return this.findOne(product.id);
  }

  // Agregar imágenes a un producto existente
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

  // Obtener todos los productos con sus imágenes
  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['images'],
      order: { name: 'ASC' },
    });
  }

  // Obtener un producto con sus imágenes
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

  // Actualizar producto
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    await this.productRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  // Eliminar producto
  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  // Eliminar una imagen específica
  async removeImage(imageId: string): Promise<void> {
    const image = await this.productImageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    await this.productImageRepository.remove(image);
  }
}
