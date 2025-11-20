import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Crear producto con imágenes
  @Post()
  @UseInterceptors(FilesInterceptor('images', 10))
  create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.create(createProductDto, files);
  }

  // Agregar imágenes a producto existente
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  addImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.addImages(id, files);
  }

  // Obtener todos los productos
  @Get()
  findAll() {
    return this.productService.findAll();
  }

  // Obtener solo productos disponibles
  @Get('available')
  findAllAvailable() {
    return this.productService.findAllAvailable();
  }

  // Obtener categorías
  @Get('categories')
  getCategories() {
    return this.productService.getCategories();
  }

  // Buscar productos por nombre
  @Get('search')
  searchByName(@Query('q') query: string) {
    return this.productService.searchByName(query);
  }

  // Obtener productos por categoría
  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.productService.findByCategory(category);
  }

  // Obtener más populares
  @Get('popular')
  getMostPopular(@Query('limit') limit?: number) {
    return this.productService.getMostPopular(limit || 10);
  }

  // Obtener un producto
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  // Actualizar producto
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  // Toggle disponibilidad
  @Patch(':id/toggle-availability')
  toggleAvailability(@Param('id') id: string) {
    return this.productService.toggleAvailability(id);
  }

  // Eliminar producto
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  // Eliminar imagen
  @Delete('images/:imageId')
  removeImage(@Param('imageId') imageId: string) {
    return this.productService.removeImage(imageId);
  }
}
