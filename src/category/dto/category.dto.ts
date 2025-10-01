import { ApiProperty } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({ description: 'The id of the category' })
  id: number;

  @ApiProperty({ description: 'The name of the category' })
  name: string;

  @ApiProperty({ description: 'The description of the category' })
  description: string;

  @ApiProperty({ description: 'The icon of the category' })
  icon: string;

  constructor(id: number, name: string, description: string, icon: string) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.icon = icon;
  }
}
