import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthRequest } from '../auth/auth.service';
import {
  CreateBranchDto,
  ListBranchesDto,
  UpdateBranchDto,
} from './branches.dto';
import { BranchesService } from './branches.service';
@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1/businesses/:businessId/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'List branches; defaults to active' })
  list(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query() query: ListBranchesDto,
  ) {
    return this.branches.list(req.identity.userId, businessId, query);
  }
  @Post()
  @ApiOperation({ summary: 'Create a branch (Owner or Admin)' })
  create(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() body: CreateBranchDto,
  ) {
    return this.branches.create(req.identity.userId, businessId, body);
  }
  @Get(':branchId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Get active or archived branch details' })
  get(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) id: string,
  ) {
    return this.branches.get(req.identity.userId, businessId, id);
  }
  @Patch(':branchId')
  @ApiOperation({ summary: 'Edit an active branch (Owner or Admin)' })
  update(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) id: string,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branches.update(req.identity.userId, businessId, id, body);
  }
  @Post(':branchId/archive')
  @ApiOperation({
    summary: 'Archive a branch (Owner only); preserves last active branch',
  })
  archive(
    @Req() req: AuthRequest,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('branchId', ParseUUIDPipe) id: string,
  ) {
    return this.branches.archive(req.identity.userId, businessId, id);
  }
}
